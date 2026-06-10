// POST /api/admin/draft-plan — owner-only. Drafts the client-facing plan summary
// (the `planSummary` field shown in the portal) from the project's questionnaire
// answers + booking facts, in Julian's voice. Julian reviews/edits the draft in
// the form and saves it like any other field.
//
// Client-facing on purpose: this deliberately does NOT read internal notes or
// budget — only the client's own questionnaire answers and neutral facts — so a
// private note can never leak into a portal-visible field. No-ops gracefully
// (`drafted: false`) when AI isn't configured or the project can't be resolved.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull } from "@/lib/clients";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel } from "@/lib/ai/ai";
import { buildAnswerDigest } from "@/lib/questionnaire-digest";
import { serviceNoun } from "@/lib/project-name";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
});

const SYSTEM_PROMPT = [
  "You are Julian Perez, a wedding and portrait photographer in the DMV, writing a short 'plan summary' that your client sees on their private project portal. It is a warm, reassuring overview of the plan for their session or day — written TO the client, in your own first-person voice.",
  "",
  "Use ONLY the facts and the client's questionnaire answers provided. Never invent a time, price, location, or detail that isn't there. If something important is missing, leave a short [bracket] for yourself to fill in later rather than guessing.",
  "",
  "This is CLIENT-FACING. Keep it warm and high-level. Do NOT include internal logistics, shot lists, gear notes, pricing, or anything that reads like a checklist — that lives elsewhere. A few short, friendly sentences (one short paragraph, occasionally two) is plenty.",
  "",
  "Return ONLY the plan-summary text — no subject line, no preamble, no sign-off, and no quotation marks around it.",
].join("\n");

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-draft-plan",
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

  if (!aiEnabled()) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  const record = await getClientFull(parsed.data.projectId);
  if (!record) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  try {
    const noun = serviceNoun(record.serviceType)?.toLowerCase();
    const venue =
      record.locations?.[0]?.label || record.locations?.[0]?.address;
    const digest = record.questionnaireSnapshot?.trim()
      ? buildAnswerDigest(record.serviceType, record.questionnaireSnapshot)
      : null;

    const facts = [
      `Service: ${noun ?? "not specified"}`,
      `Client: ${record.clientName ?? "not provided"}`,
      record.partnerName ? `Partner: ${record.partnerName}` : null,
      `Event date: ${record.eventDate ?? "not provided"}`,
      `Venue / location: ${venue ?? "not provided"}`,
      record.package ? `Package: ${record.package}` : null,
      record.guestCount != null ? `Guest count: ${record.guestCount}` : null,
    ].filter(Boolean);

    const prompt = [
      "Facts:",
      facts.map((f) => `- ${f}`).join("\n"),
      "",
      digest
        ? `The client's questionnaire answers:\n${digest}`
        : "(No questionnaire submitted yet — base the summary on the facts above.)",
      "",
      "Write the plan summary now.",
    ].join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 600,
      temperature: 0.6,
    });

    if (!raw?.trim()) {
      return NextResponse.json({ ok: true, drafted: false });
    }

    // Strip stray wrapping quotes the model sometimes adds.
    const summary = raw.trim().replace(/^["'“]+|["'”]+$/g, "").trim();
    return NextResponse.json({ ok: true, drafted: true, summary });
  } catch (err) {
    console.error("[admin] draft-plan error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-draft-plan", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't draft right now — please try again." },
      { status: 502 },
    );
  }
}
