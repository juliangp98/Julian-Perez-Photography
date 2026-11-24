// POST /api/admin/triage: owner-only, on demand. Assesses a project's inquiry
// (summary, fit, urgency, key details) to help prioritize it. It writes no reply;
// the compose panel is the one place client emails are drafted.

export const runtime = "nodejs";

import { daysUntil } from "@/lib/field-format";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { apiError, defineRoute } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { serviceNoun } from "@/lib/project-name";

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
});

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
  '  "keyDetails": ["short factual bullets worth saving to the record: date, budget, guest count, venue, referral — ONLY those actually stated"]',
  "}",
].join("\n");

export const POST = defineRoute({
  route: "admin/triage",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't triage right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data) => {
    if (!aiEnabled()) return { ok: true, triaged: false };

    const record = await getClientFull(data.projectId);
    // Nothing to triage (no record, or no inquiry text on it).
    if (!record?.inquiryMessage?.trim()) return { ok: true, triaged: false };

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

    if (!raw) return { ok: true, triaged: false };

    const valid = triageSchema.safeParse(extractJsonObject(raw));
    if (!valid.success) {
      // The model returned something unusable: a soft failure.
      Sentry.captureException(new Error("Triage JSON failed validation"), {
        tags: { route: "admin/triage", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return apiError(502, "Couldn't read the assessment. Try again.");
    }

    return { ok: true, triaged: true, triage: valid.data };
  },
});
