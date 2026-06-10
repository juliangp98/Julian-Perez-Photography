// POST /api/admin/next-action — owner-only. Suggests the single best next step
// on a project from where it sits in the pipeline (status, history, days
// elapsed, event proximity, and what's still missing), and — when sending an
// email is the right move — which template fits. Complements the always-on,
// heuristic needs-attention strip with a smarter per-project read.
//
// On-demand (never auto-run, so it doesn't fan out an AI call per card on the
// board). No-ops gracefully (`suggested: false`) when AI isn't configured or the
// project can't be resolved. Admin-only output, so it may reason over internal
// notes — but it only returns a recommendation, never client-facing copy.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull } from "@/lib/clients";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { EMAIL_TEMPLATES } from "@/lib/email/email-pipeline";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
});

const actionSchema = z.object({
  nextStep: z.string().max(600),
  why: z.string().max(600).default(""),
  urgency: z.enum(["high", "medium", "low"]).catch("medium"),
  suggestedTemplateId: z.string().max(100).nullish(),
});

function daysBetweenNow(d?: string): number | null {
  if (!d) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? `${d.trim()}T00:00:00` : d;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((Date.now() - date.getTime()) / 86_400_000);
}

const SYSTEM_PROMPT = [
  "You help Julian Perez, a wedding and portrait photographer, decide the single best next step on a client project, based on where it sits in his pipeline. Be concrete, brief, and practical. Base your answer ONLY on the information provided — never invent facts.",
  "",
  "His pipeline, in order: new-inquiry → responded → in-conversation → proposal-sent → booked → contract-signed → planning → scheduled → shot → editing → delivered → complete (plus archived / lost off-ramps).",
  "",
  "He has a library of email templates (listed in the prompt). If sending one is the right next move, pick the single best-fit template id; otherwise use null — e.g. when the next step is a call, an internal task, or simply waiting on the client.",
  "",
  "Return STRICT JSON and nothing else:",
  "{",
  '  "nextStep": "the single best next action, as a short imperative",',
  '  "why": "one short sentence of reasoning (status, days elapsed, what is missing)",',
  '  "urgency": "high" | "medium" | "low",',
  '  "suggestedTemplateId": "<one id from the list>" or null',
  "}",
].join("\n");

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-next-action",
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
    return NextResponse.json({ ok: true, suggested: false });
  }

  const record = await getClientFull(parsed.data.projectId);
  if (!record) {
    return NextResponse.json({ ok: true, suggested: false });
  }

  try {
    const clientLabel = record.status
      ? CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus]
      : undefined;
    const daysSinceUpdate = daysBetweenNow(record.updatedAt);
    const daysToEvent =
      record.eventDate != null ? daysBetweenNow(record.eventDate) : null;
    const recentNotes = (record.statusHistory ?? [])
      .slice(-3)
      .map((h) =>
        [h.status, h.note].filter(Boolean).join(": "),
      )
      .filter(Boolean);

    const eventLine =
      record.eventDate && daysToEvent != null
        ? `Event date: ${record.eventDate} (${
            daysToEvent <= 0 ? `in ${-daysToEvent} days` : `${daysToEvent} days ago`
          })`
        : record.eventDate
          ? `Event date: ${record.eventDate}`
          : "Event date: not set";

    const state = [
      `Pipeline status: ${record.status ?? "unknown"}${
        clientLabel ? ` (client sees: "${clientLabel}")` : ""
      }`,
      daysSinceUpdate != null
        ? `Days since last update: ${daysSinceUpdate}`
        : "Days since last update: unknown",
      eventLine,
      `Questionnaire submitted: ${record.questionnaireSnapshot?.trim() ? "yes" : "no"}`,
      `Gallery link set: ${record.galleryUrl?.trim() ? "yes" : "no"}`,
      `Client email on file: ${record.email?.trim() ? "yes" : "no"}`,
      `Package: ${record.package ?? "not set"}`,
      `Recent log notes: ${recentNotes.length ? recentNotes.join(" | ") : "none"}`,
    ];

    const templateList = EMAIL_TEMPLATES.map(
      (t) => `- ${t.id} — ${t.name} (stage: ${t.stage})`,
    ).join("\n");

    const prompt = [
      "Project state:",
      state.map((s) => `- ${s}`).join("\n"),
      "",
      "Email templates available (id — name — stage):",
      templateList,
      "",
      "What is the single best next step?",
    ].join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 512,
      temperature: 0.4,
    });

    if (!raw) {
      return NextResponse.json({ ok: true, suggested: false });
    }

    const valid = actionSchema.safeParse(extractJsonObject(raw));
    if (!valid.success) {
      Sentry.captureException(new Error("Next-action JSON failed validation"), {
        tags: { route: "admin-next-action", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return NextResponse.json(
        { error: "Couldn't read the suggestion — please try again." },
        { status: 502 },
      );
    }

    // Resolve the suggested template id to a real registry entry (or drop it).
    const tmpl = valid.data.suggestedTemplateId
      ? EMAIL_TEMPLATES.find((t) => t.id === valid.data.suggestedTemplateId)
      : undefined;

    return NextResponse.json({
      ok: true,
      suggested: true,
      action: {
        nextStep: valid.data.nextStep,
        why: valid.data.why,
        urgency: valid.data.urgency,
        suggestedTemplate: tmpl ? { id: tmpl.id, name: tmpl.name } : null,
      },
    });
  } catch (err) {
    console.error("[admin] next-action error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-next-action", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't suggest a next step right now — please try again." },
      { status: 502 },
    );
  }
}
