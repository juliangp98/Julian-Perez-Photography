// POST /api/admin/prep-brief — owner-only. Turns a project's submitted planning
// questionnaire into a tight, practical shoot-day prep brief (timeline, key
// people, must-have shots, locations, logistics, style). Reads the snapshot
// server-side and resolves field IDs to their human labels via the questionnaire
// schema so the model sees readable answers, not raw keys.
//
// On-demand (never auto-run). No-ops gracefully (`generated: false`) when AI
// isn't configured, the project can't be resolved, or it has no questionnaire to
// work from.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull } from "@/lib/clients";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { buildAnswerDigest } from "@/lib/questionnaire-digest";
import { serviceNoun } from "@/lib/project-name";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
});

const briefSchema = z.object({
  headline: z.string().max(600).default(""),
  sections: z
    .array(
      z.object({
        heading: z.string().max(200),
        bullets: z.array(z.string().max(800)).max(40).default([]),
      }),
    )
    .max(20)
    .default([]),
});

function daysUntil(d?: string): number | null {
  if (!d) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? `${d.trim()}T00:00:00` : d;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - Date.now()) / 86_400_000);
}

const SYSTEM_PROMPT = [
  "You are an assistant helping Julian Perez, a wedding and portrait photographer in the DMV, prepare for an upcoming shoot. Turn the client's submitted planning questionnaire into a tight, practical prep brief he can skim the morning of and again on location.",
  "",
  "Use ONLY the information in the questionnaire and the facts provided. Never invent a time, name, location, or detail that isn't there. If something important is clearly missing, you may add a short '[confirm with client]' note — but never fabricate the answer.",
  "",
  "Be concrete and scannable: short bullets, not paragraphs. Pull out what matters for actually shooting the day — the timeline, the key people and how to recognize them, must-have and special-request shots, locations, sentimental moments and traditions, logistics and heads-up items (weather backup, restrictions, vendor contacts), and the client's style preferences.",
  "",
  "Return STRICT JSON and nothing else (no markdown fence, no prose around it):",
  "{",
  '  "headline": "one line: who + occasion + date + venue + guest count, using only known facts",',
  '  "sections": [ { "heading": "e.g. Timeline, Key people, Must-have shots, Locations, Special moments, Logistics & heads-up, Style", "bullets": ["short concrete items"] } ]',
  "}",
  "",
  "Omit any section with nothing to say. Order the sections the way a photographer would want them on the day.",
].join("\n");

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-prep-brief",
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
    return NextResponse.json({ ok: true, generated: false });
  }

  const record = await getClientFull(parsed.data.projectId);
  if (!record?.questionnaireSnapshot?.trim()) {
    return NextResponse.json({ ok: true, generated: false });
  }

  const digest = buildAnswerDigest(
    record.serviceType,
    record.questionnaireSnapshot,
  );
  if (!digest) {
    return NextResponse.json({ ok: true, generated: false });
  }

  try {
    const noun = serviceNoun(record.serviceType)?.toLowerCase();
    const days = daysUntil(record.eventDate);
    const venue =
      record.locations?.[0]?.label || record.locations?.[0]?.address;

    const facts = [
      `Service: ${noun ?? "not specified"}`,
      `Client: ${record.clientName ?? "not provided"}`,
      record.partnerName ? `Partner: ${record.partnerName}` : null,
      record.eventDate
        ? `Event date: ${record.eventDate}${
            days != null && days >= 0 ? ` (in ${days} days)` : ""
          }`
        : "Event date: not provided",
      `Venue / location: ${venue ?? "not provided"}`,
      record.guestCount != null
        ? `Guest count: ${record.guestCount}`
        : "Guest count: not provided",
    ].filter(Boolean);

    const prompt = [
      "Project facts:",
      facts.map((f) => `- ${f}`).join("\n"),
      "",
      "Questionnaire answers:",
      digest,
      "",
      "Produce the prep brief JSON now.",
    ].join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 1800,
      temperature: 0.4,
    });

    if (!raw) {
      return NextResponse.json({ ok: true, generated: false });
    }

    const valid = briefSchema.safeParse(extractJsonObject(raw));
    if (!valid.success || valid.data.sections.length === 0) {
      Sentry.captureException(new Error("Prep brief JSON failed validation"), {
        tags: { route: "admin-prep-brief", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return NextResponse.json(
        { error: "Couldn't read the brief — please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, generated: true, brief: valid.data });
  } catch (err) {
    console.error("[admin] prep-brief error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-prep-brief", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't build the brief right now — please try again." },
      { status: 502 },
    );
  }
}
