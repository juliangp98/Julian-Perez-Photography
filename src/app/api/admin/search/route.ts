// POST /api/admin/search: owner-only, read-only. The model turns a plain-English
// query into a structured filter applied to the client list server-side; matches
// carry the fields the board already shows, never internal notes.

export const runtime = "nodejs";

import { daysUntil } from "@/lib/field-format";
import { z } from "zod";
import { apiError, defineRoute } from "@/lib/api-route";
import { listClients } from "@/lib/clients";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { projectDisplayName } from "@/lib/project-name";
import {
  CLIENT_STATUS_FLOW,
  CLIENT_STATUS_TERMINAL,
} from "@/lib/client-status";
import { statusTitle } from "@/lib/labels";
import { services } from "@/lib/services-data";

const schema = z.object({
  query: z.string().min(1).max(400),
});

const specSchema = z.object({
  statuses: z.array(z.string()).max(14).nullish(),
  service: z.string().max(100).nullish(),
  text: z.string().max(200).nullish(),
  eventMonth: z.number().int().min(1).max(12).nullish(),
  eventYear: z.number().int().min(2000).max(2100).nullish(),
  upcomingDays: z.number().int().min(0).max(3650).nullish(),
  hasGallery: z.boolean().nullish(),
  missingQuestionnaire: z.boolean().nullish(),
  summary: z.string().max(300).default(""),
});
type Spec = z.infer<typeof specSchema>;

function eventParts(d?: string): { month: number; year: number } | null {
  if (!d) return null;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? `${d.trim()}T00:00:00` : d;
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

const SYSTEM_PROMPT = [
  "You convert a photographer's natural-language search over his client projects into a structured filter. Output ONLY JSON — no prose, no code fence.",
  "",
  "Use only the fields the query implies; set the rest to null:",
  "- statuses: array of pipeline status slugs to include. Map phrases like 'not booked yet' / 'no contract yet' / 'still a lead' to the appropriate set of EARLIER pipeline statuses (everything before that milestone).",
  "- service: one service slug.",
  "- text: a free-text name/email fragment to match on.",
  "- eventMonth (1-12) and eventYear: for month/season mentions. Resolve relative terms using today's date; for a bare month already past this year, assume next year.",
  "- upcomingDays: for 'upcoming', 'this week', 'this month', 'soon'.",
  "- hasGallery (boolean): true for 'delivered' / 'has a gallery', false for 'no gallery yet'.",
  "- missingQuestionnaire (boolean): true for \"hasn't filled the questionnaire\".",
  "- summary: a short plain-English description of how you interpreted the query.",
  "",
  'Return ONLY: { "statuses": []|null, "service": ""|null, "text": ""|null, "eventMonth": n|null, "eventYear": n|null, "upcomingDays": n|null, "hasGallery": true|false|null, "missingQuestionnaire": true|false|null, "summary": "" }',
].join("\n");

function applySpec(
  clients: Awaited<ReturnType<typeof listClients>>,
  spec: Spec,
) {
  const text = spec.text?.trim().toLowerCase();
  const statuses = spec.statuses?.length ? new Set(spec.statuses) : null;
  return clients.filter((r) => {
    if (statuses && !statuses.has(r.status ?? "")) return false;
    if (spec.service && r.serviceType !== spec.service) return false;
    if (text) {
      const hay = [r.clientName, r.email, projectDisplayName(r)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(text)) return false;
    }
    if (spec.eventMonth != null || spec.eventYear != null) {
      const ep = eventParts(r.eventDate);
      if (!ep) return false;
      if (spec.eventMonth != null && ep.month !== spec.eventMonth) return false;
      if (spec.eventYear != null && ep.year !== spec.eventYear) return false;
    }
    if (spec.upcomingDays != null) {
      const d = daysUntil(r.eventDate);
      if (d == null || d < 0 || d > spec.upcomingDays) return false;
    }
    if (spec.hasGallery != null) {
      if (!!r.galleryUrl?.trim() !== spec.hasGallery) return false;
    }
    if (spec.missingQuestionnaire != null) {
      if (!r.questionnaireSnapshot?.trim() !== spec.missingQuestionnaire) {
        return false;
      }
    }
    return true;
  });
}

export const POST = defineRoute({
  route: "admin/search",
  auth: "admin",
  schema,
  rateLimit: { max: 30, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't search right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data) => {
    if (!aiEnabled()) return { ok: true, searched: false, matches: [] };

    const clients = await listClients();
    // Nothing to search: skip the provider entirely.
    if (clients.length === 0) return { ok: true, searched: true, matches: [] };

    const today = new Date().toISOString().slice(0, 10);
    const prompt = [
      `Today: ${today}.`,
      `Valid statuses (pipeline order): ${[...CLIENT_STATUS_FLOW, ...CLIENT_STATUS_TERMINAL].join(", ")}`,
      `Valid services: ${services.map((s) => s.slug).join(", ")}`,
      `Query: "${data.query.trim()}"`,
    ].join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 400,
      temperature: 0.2,
    });

    const valid = raw ? specSchema.safeParse(extractJsonObject(raw)) : null;
    if (!valid?.success) {
      return apiError(502, "Couldn't read that search. Try rephrasing.");
    }

    const matches = applySpec(clients, valid.data).map((r) => ({
      id: r.id,
      name: projectDisplayName(r),
      clientName: r.clientName ?? null,
      status: r.status ?? null,
      statusTitle: statusTitle(r.status) || null,
      serviceType: r.serviceType ?? null,
      eventDate: r.eventDate ?? null,
    }));

    return {
      ok: true,
      searched: true,
      summary: valid.data.summary,
      matches,
    };
  },
});
