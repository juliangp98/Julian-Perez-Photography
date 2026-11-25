// POST /api/admin/draft-plan: owner-only. Drafts the portal-visible plan summary
// from the client's questionnaire answers and booking facts. It never reads internal
// notes or budget; no-ops (`drafted: false`) without a key or an unknown project.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { generateText, aiEnabled, aiModel } from "@/lib/ai/ai";
import { buildAnswerDigest } from "@/lib/questionnaire-digest";
import { serviceNoun } from "@/lib/project-name";

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

export const POST = defineRoute({
  route: "admin/draft-plan",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't draft right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async ({ projectId }) => {
    if (!aiEnabled()) return { ok: true, drafted: false };

    const record = await getClientFull(projectId);
    if (!record) return { ok: true, drafted: false };

    const noun = serviceNoun(record.serviceType)?.toLowerCase();
    const venue = record.locations?.[0]?.label || record.locations?.[0]?.address;
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

    if (!raw?.trim()) return { ok: true, drafted: false };

    // Strip stray wrapping quotes the model sometimes adds.
    const summary = raw.trim().replace(/^["'“]+|["'”]+$/g, "").trim();
    return { ok: true, drafted: true, summary };
  },
});
