// POST /api/admin/search — owner-only. Natural-language search over the client
// projects: the AI turns a plain-English query ("weddings in June with no
// contract yet") into a structured filter, which is then applied to the client
// list server-side. Admin-only, read-only — it returns matching projects (the
// same fields the board already shows), never internal notes.
//
// No-ops gracefully: `searched: false` when AI isn't configured, and an empty
// store short-circuits to no matches without calling the provider at all.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { listClients } from "@/lib/clients";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai";
import { projectDisplayName } from "@/lib/project-name";
import {
  CLIENT_STATUS_FLOW,
  CLIENT_STATUS_TERMINAL,
  CLIENT_STATUS_OPTIONS,
} from "@/lib/client-status";
import { services } from "@/lib/services-data";
import * as Sentry from "@sentry/nextjs";

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

function daysUntil(d?: string): number | null {
  if (!d) return null;
  const s = /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? `${d.trim()}T00:00:00` : d;
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / 86_400_000);
}

const STATUS_TITLE: Record<string, string> = Object.fromEntries(
  CLIENT_STATUS_OPTIONS.map((s) => [s.value, s.title]),
);

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

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-search",
    max: 30,
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
    return NextResponse.json({ ok: true, searched: false, matches: [] });
  }

  const clients = await listClients();
  if (clients.length === 0) {
    // Nothing to search — skip the provider entirely.
    return NextResponse.json({ ok: true, searched: true, matches: [] });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const prompt = [
      `Today: ${today}.`,
      `Valid statuses (pipeline order): ${[...CLIENT_STATUS_FLOW, ...CLIENT_STATUS_TERMINAL].join(", ")}`,
      `Valid services: ${services.map((s) => s.slug).join(", ")}`,
      `Query: "${parsed.data.query.trim()}"`,
    ].join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 400,
      temperature: 0.2,
    });

    const valid = raw ? specSchema.safeParse(extractJsonObject(raw)) : null;
    if (!valid?.success) {
      return NextResponse.json(
        { error: "Couldn't read that search — try rephrasing." },
        { status: 502 },
      );
    }

    const matches = applySpec(clients, valid.data).map((r) => ({
      id: r.id,
      name: projectDisplayName(r),
      clientName: r.clientName ?? null,
      status: r.status ?? null,
      statusTitle: r.status ? (STATUS_TITLE[r.status] ?? r.status) : null,
      serviceType: r.serviceType ?? null,
      eventDate: r.eventDate ?? null,
    }));

    return NextResponse.json({
      ok: true,
      searched: true,
      summary: valid.data.summary,
      matches,
    });
  } catch (err) {
    console.error("[admin] search error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-search", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't search right now — please try again." },
      { status: 502 },
    );
  }
}
