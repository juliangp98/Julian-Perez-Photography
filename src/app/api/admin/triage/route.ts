// POST /api/admin/triage — owner-only. Reads a project's inquiry server-side and
// returns an AI assessment to help Julian prioritize and respond: a short
// summary, a fit verdict, an urgency read, the key details worth capturing, and
// a suggested reply in his voice. On-demand (never auto-run on page load) so it
// only spends provider quota when asked.
//
// No-ops gracefully (`triaged: false`) when AI isn't configured, the project
// can't be resolved, or it has no inquiry to assess — the admin UI then simply
// doesn't show an assessment.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull } from "@/lib/clients";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { serviceNoun } from "@/lib/project-name";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
});

// Tolerant of model drift: invalid enum values fall back rather than 500.
const triageSchema = z.object({
  summary: z.string().max(1000),
  fit: z.enum(["good", "maybe", "poor"]).catch("maybe"),
  fitReason: z.string().max(500).default(""),
  urgency: z.enum(["high", "medium", "low"]).catch("medium"),
  urgencyReason: z.string().max(500).default(""),
  keyDetails: z.array(z.string().max(300)).max(12).default([]),
  suggestedReply: z.string().max(4000).default(""),
});

function daysUntil(d?: string): number | null {
  if (!d) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? `${d.trim()}T00:00:00` : d;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const ms = date.getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

const SYSTEM_PROMPT = [
  "You are an assistant helping Julian Perez, a wedding and portrait photographer in the DMV (DC, Maryland, Virginia), triage an incoming client inquiry. Your job is a brief, honest assessment that helps him prioritize and respond well.",
  "",
  "Ground every part of your answer ONLY in the information provided. Never invent a date, budget, name, or detail that isn't there. Be concise and practical — Julian is skimming this between shoots.",
  "",
  "Return STRICT JSON and nothing else (no markdown, no code fence, no text around it) with exactly these keys:",
  "{",
  '  "summary": "1-2 plain sentences: what they want and the occasion",',
  '  "fit": "good" | "maybe" | "poor",',
  '  "fitReason": "one short sentence — service match, budget signal, scope, date",',
  '  "urgency": "high" | "medium" | "low",',
  '  "urgencyReason": "one short sentence — event-date proximity, ready-to-book tone, etc.",',
  '  "keyDetails": ["short factual bullets worth saving to the record: date, budget, guest count, venue, referral — ONLY those actually stated"],',
  '  "suggestedReply": "a short, warm first reply in Julian\'s first-person voice (3-6 sentences). Use only known facts; leave [brackets] for anything you would need to fill in. Sign off as Julian."',
  "}",
  "",
  "Voice for suggestedReply: warm, genuine, documentary-first, professional but personable — never salesy or stiff. Match how a thoughtful small-business photographer actually writes.",
].join("\n");

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-triage",
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
    return NextResponse.json({ ok: true, triaged: false });
  }

  const record = await getClientFull(parsed.data.projectId);
  if (!record?.inquiryMessage?.trim()) {
    // Nothing to triage (no record, or no inquiry text on it).
    return NextResponse.json({ ok: true, triaged: false });
  }

  try {
    const noun = serviceNoun(record.serviceType)?.toLowerCase();
    const days = daysUntil(record.eventDate);
    const venue =
      record.locations?.[0]?.label || record.locations?.[0]?.address;

    const facts = [
      `Service requested: ${noun ?? "not specified"}`,
      `Client name: ${record.clientName ?? "not provided"}`,
      record.eventDate
        ? `Event date: ${record.eventDate}${
            days != null
              ? days >= 0
                ? ` (in ${days} days)`
                : ` (${Math.abs(days)} days ago)`
              : ""
          }`
        : "Event date: not provided",
      `Budget: ${record.budget ?? "not provided"}`,
      `Guest count: ${record.guestCount ?? "not provided"}`,
      `Location / venue: ${venue ?? "not provided"}`,
      `Referral source: ${record.referral ?? "not provided"}`,
    ];

    const prompt = [
      "Inquiry facts:",
      facts.map((f) => `- ${f}`).join("\n"),
      "",
      "Their message:",
      '"""',
      record.inquiryMessage.trim(),
      '"""',
      "",
      "Produce the triage JSON now.",
    ].join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 1024,
      temperature: 0.4,
    });

    if (!raw) {
      return NextResponse.json({ ok: true, triaged: false });
    }

    const extracted = extractJsonObject(raw);
    const valid = triageSchema.safeParse(extracted);
    if (!valid.success) {
      // The model returned something unusable — treat as a soft failure.
      Sentry.captureException(new Error("Triage JSON failed validation"), {
        tags: { route: "admin-triage", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return NextResponse.json(
        { error: "Couldn't read the assessment — please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, triaged: true, triage: valid.data });
  } catch (err) {
    console.error("[admin] triage error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-triage", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't triage right now — please try again." },
      { status: 502 },
    );
  }
}
