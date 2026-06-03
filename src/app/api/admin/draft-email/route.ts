// POST /api/admin/draft-email — owner-only. Turns a pipeline template + the
// project's real context into a personalized, on-brand draft the owner reviews
// and edits before sending (this route never sends). The project is loaded
// server-side, so only the minimal facts a draft needs leave the server — never
// internal notes or budget, and never PII trusted from the request body.
//
// No-ops gracefully (`drafted: false`) when AI isn't configured or the project
// can't be resolved, so the compose UI simply falls back to the static template.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull } from "@/lib/clients";
import { rateLimitResponse } from "@/lib/request-guard";
import { EMAIL_TEMPLATES, fillTemplate } from "@/lib/email-pipeline";
import { generateText, aiEnabled, aiModel } from "@/lib/ai";
import { buildVoiceSystemPrompt } from "@/lib/ai-voice";
import { projectDisplayName, serviceNoun } from "@/lib/project-name";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
  templateId: z.string().min(1),
  instructions: z.string().max(2000).optional(),
});

function longDate(d?: string): string | undefined {
  if (!d) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? `${d.trim()}T00:00:00` : d;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Split the model's "Subject: …\n\n<body>" output; fall back to the template's
// own subject if the model didn't follow the format.
function parseDraft(
  text: string,
  fallbackSubject: string,
): { subject: string; body: string } {
  const m = text.match(/^\s*subject:\s*(.+?)[\r\n]+([\s\S]*)$/i);
  if (m && m[2].trim()) {
    return { subject: m[1].trim(), body: m[2].trim() };
  }
  return { subject: fallbackSubject, body: text.trim() };
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  // AI calls cost provider quota — cap per IP even though the route is admin-only.
  const limited = rateLimitResponse(req, {
    key: "admin-draft-email",
    max: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const template = EMAIL_TEMPLATES.find((t) => t.id === parsed.data.templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template." }, { status: 400 });
  }

  // Not configured → let the UI keep the static template (no error).
  if (!aiEnabled()) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  // Resolve the project server-side; never trust PII from the body.
  const record = await getClientFull(parsed.data.projectId);
  if (!record) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  try {
    const origin = req.headers.get("origin") || new URL(req.url).origin;
    const noun = serviceNoun(record.serviceType)?.toLowerCase();
    const name = projectDisplayName(record);
    const eventDate = longDate(record.eventDate);
    const venue =
      record.locations?.[0]?.label || record.locations?.[0]?.address;

    // The same token context the manual compose panel uses, so URLs the draft
    // should keep (portal, booking, gallery, questionnaire) are real values.
    const ctx: Record<string, string | undefined> = {
      firstName: record.clientName?.trim().split(/\s+/)[0],
      clientName: record.clientName,
      projectName: name,
      serviceNoun: noun,
      eventDate,
      venue,
      galleryUrl: record.galleryUrl,
      portalUrl: `${origin}/portal`,
      bookingUrl: `${origin}/book`,
      questionnaireUrl: record.serviceType
        ? `${origin}/questionnaire/${record.serviceType}`
        : undefined,
    };

    // Minimal, client-appropriate facts — no internal notes, no budget.
    const facts: string[] = [];
    if (record.clientName) facts.push(`Client name: ${record.clientName}`);
    if (record.partnerName) facts.push(`Partner: ${record.partnerName}`);
    facts.push(`Project: ${name}`);
    if (noun) facts.push(`Service: ${noun}`);
    if (record.status) {
      const label = CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus];
      if (label) facts.push(`Current stage: ${label}`);
    }
    if (eventDate) facts.push(`Event date: ${eventDate}`);
    if (venue) facts.push(`Venue / location: ${venue}`);
    if (record.package) facts.push(`Package: ${record.package}`);
    if (record.guestCount != null)
      facts.push(`Guest count: ${record.guestCount}`);
    if (record.planSummary) facts.push(`Plan summary: ${record.planSummary}`);
    if (ctx.galleryUrl) facts.push(`Gallery link: ${ctx.galleryUrl}`);
    facts.push(`Client portal link: ${ctx.portalUrl}`);
    if (ctx.questionnaireUrl)
      facts.push(`Planning questionnaire link: ${ctx.questionnaireUrl}`);
    facts.push(`Booking link: ${ctx.bookingUrl}`);

    const guide = fillTemplate(template.body, ctx);
    const prompt = [
      `Write the "${template.name}" email for this client.`,
      "",
      "Here is the template I usually start from for this kind of email. Use it as a structural guide — keep its purpose and keep any URLs exactly as written — but personalize it and make it sound like a real, individual note rather than a form letter:",
      "----",
      `Subject: ${template.subject}`,
      "",
      guide,
      "----",
      "",
      "Facts about THIS client and project (use only these — do not invent anything not listed):",
      facts.map((f) => `- ${f}`).join("\n"),
      parsed.data.instructions?.trim()
        ? `\nExtra instructions for this specific draft: ${parsed.data.instructions.trim()}`
        : "",
      "",
      "Now write the personalized email in the required Subject/body format.",
    ].join("\n");

    const raw = await generateText({
      system: buildVoiceSystemPrompt(),
      prompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    if (!raw) {
      // Key vanished between the check and the call — fall back, don't error.
      return NextResponse.json({ ok: true, drafted: false });
    }

    const draft = parseDraft(raw, fillTemplate(template.subject, ctx));
    return NextResponse.json({ ok: true, drafted: true, ...draft });
  } catch (err) {
    console.error("[admin] draft-email error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-draft-email", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't draft right now — please try again." },
      { status: 502 },
    );
  }
}
