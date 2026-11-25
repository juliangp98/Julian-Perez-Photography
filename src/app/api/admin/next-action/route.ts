// POST /api/admin/next-action: owner-only, on demand. Suggests the single best
// next step on a project and, when an email fits, which template. It may read
// internal notes but returns only a recommendation, never client-facing copy.

export const runtime = "nodejs";

import { daysBetween, daysUntil, studioDayOf, studioToday } from "@/lib/field-format";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { apiError, defineRoute } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { projectLink } from "@/lib/project-links";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { EMAIL_TEMPLATES } from "@/lib/email/email-pipeline";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "@/lib/client-status";

const schema = z.object({
  projectId: z.string().min(1),
});

const actionSchema = z.object({
  nextStep: z.string().max(600),
  why: z.string().max(600).default(""),
  urgency: z.enum(["high", "medium", "low"]).catch("medium"),
  suggestedTemplateId: z.string().max(100).nullish(),
});

// Days since a date (positive when it's past).
const negate = (n: number | null) => (n == null ? null : -n);

const SYSTEM_PROMPT = [
  "You help Julian Perez, a wedding and portrait photographer, decide the single best next step on a client project, based on where it sits in his pipeline. Be concrete, brief, and practical. Base your answer ONLY on the information provided. Never invent facts.",
  "",
  "His pipeline, in order: new-inquiry → responded → in-conversation → proposal-sent → booked → contract-signed → planning → scheduled → shot → editing → delivered → complete (plus archived / lost off-ramps).",
  "",
  "He has a library of email templates (listed in the prompt). If sending one is the right next move, pick the single best-fit template id; otherwise use null (e.g. when the next step is a call, an internal task, or simply waiting on the client).",
  "",
  "Return STRICT JSON and nothing else:",
  "{",
  '  "nextStep": "the single best next action, as a short imperative",',
  '  "why": "one short sentence of reasoning (status, days elapsed, what is missing)",',
  '  "urgency": "high" | "medium" | "low",',
  '  "suggestedTemplateId": "<one id from the list>" or null',
  "}",
].join("\n");

export const POST = defineRoute({
  route: "admin/next-action",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't suggest a next step right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data) => {
    if (!aiEnabled()) return { ok: true, suggested: false };

    const record = await getClientFull(data.projectId);
    if (!record) return { ok: true, suggested: false };

    const clientLabel = record.status
      ? CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus]
      : undefined;
    const updatedDay = record.updatedAt ? studioDayOf(record.updatedAt) : "";
    const daysSinceUpdate = updatedDay ? daysBetween(updatedDay, studioToday()) : null;
    const daysToEvent =
      record.eventDate != null ? negate(daysUntil(record.eventDate)) : null;
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
      `Gallery link set: ${projectLink(record, "gallery") ? "yes" : "no"}`,
      `Client email on file: ${record.email?.trim() ? "yes" : "no"}`,
      `Package: ${record.package ?? "not set"}`,
      `Recent log notes: ${recentNotes.length ? recentNotes.join(" | ") : "none"}`,
    ];

    const templateList = EMAIL_TEMPLATES.map(
      (t) => `- ${t.id}: ${t.name} (stage: ${t.stage})`,
    ).join("\n");

    const prompt = [
      "Project state:",
      state.map((s) => `- ${s}`).join("\n"),
      "",
      "Email templates available (id: name (stage)):",
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

    if (!raw) return { ok: true, suggested: false };

    const valid = actionSchema.safeParse(extractJsonObject(raw));
    if (!valid.success) {
      Sentry.captureException(new Error("Next-action JSON failed validation"), {
        tags: { route: "admin/next-action", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return apiError(502, "Couldn't read the suggestion. Try again.");
    }

    // Resolve the suggested template id to a real registry entry (or drop it).
    const tmpl = valid.data.suggestedTemplateId
      ? EMAIL_TEMPLATES.find((t) => t.id === valid.data.suggestedTemplateId)
      : undefined;

    return {
      ok: true,
      suggested: true,
      action: {
        nextStep: valid.data.nextStep,
        why: valid.data.why,
        urgency: valid.data.urgency,
        suggestedTemplate: tmpl ? { id: tmpl.id, name: tmpl.name } : null,
      },
    };
  },
});
