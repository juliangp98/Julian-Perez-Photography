// POST /api/admin/draft-copy — owner-only. Drafts or tightens the marketing copy
// (tagline, description, intro) for a service or portfolio page, in Julian's
// voice, from the copy that's currently live. The AI never publishes — it
// returns improved copy for Julian to review and paste into Sanity Studio.
//
// No-ops gracefully (`drafted: false`) when AI isn't configured or the subject
// can't be resolved.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai";
import { getService, getPortfolio } from "@/lib/content";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  kind: z.enum(["service", "portfolio"]),
  slug: z.string().min(1).max(100),
  mode: z.enum(["tighten", "rewrite", "fresh"]),
  angle: z.string().max(500).optional(),
});

const copySchema = z.object({
  tagline: z.string().max(300).default(""),
  description: z.string().max(800).default(""),
  intro: z.array(z.string().max(2000)).max(8).default([]),
});

const MODE_INSTRUCTION: Record<string, string> = {
  tighten:
    "Keep the existing meaning and Julian's voice — make it crisper, tighter, and more compelling. Cut filler; don't change the offering.",
  rewrite:
    "Rewrite the copy fresh while keeping the same offering and facts. Vary the structure and phrasing from the current version.",
  fresh:
    "Draft this copy from scratch for the subject, based on its title and the angle (the current copy is thin or missing).",
};

const SYSTEM_PROMPT_BASE = [
  "You are helping Julian Perez, a wedding and portrait photographer in the DMV (DC, Maryland, Virginia), write the marketing copy for a page on his website. Write in his voice: warm, genuine, and confident without hype — benefit-focused and specific, never generic or salesy. Speak to the prospective client.",
  "",
  "Use ONLY the facts in the current copy and the page's subject. Never invent prices, package names, specific statistics, or claims that aren't supported by what you're given.",
  "",
  "Return STRICT JSON and nothing else:",
  "{",
  '  "tagline": "a short, punchy one-line tagline (<= 80 characters)",',
  '  "description": "a 1-2 sentence summary for the page header and listings (<= 240 characters)",',
  '  "intro": ["1-3 short philosophy / benefit paragraphs shown above the packages"]',
  "}",
  'For a portfolio page, "intro" may be an empty array.',
].join("\n");

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-draft-copy",
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

  // Resolve the live copy server-side.
  const subject =
    parsed.data.kind === "service"
      ? await getService(parsed.data.slug)
      : await getPortfolio(parsed.data.slug);
  if (!subject) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  try {
    const current = subject as {
      title?: string;
      tagline?: string;
      description?: string;
      intro?: string[];
    };
    const prompt = [
      `Subject: ${current.title ?? parsed.data.slug} (${parsed.data.kind} page)`,
      parsed.data.angle?.trim()
        ? `Angle / emphasis: ${parsed.data.angle.trim()}`
        : "",
      "",
      "Current copy:",
      `- Tagline: ${current.tagline || "(none)"}`,
      `- Description: ${current.description || "(none)"}`,
      `- Intro: ${current.intro?.length ? current.intro.join("\n\n") : "(none)"}`,
      "",
      MODE_INSTRUCTION[parsed.data.mode],
      "",
      "Write the improved copy now.",
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT_BASE,
      prompt,
      maxTokens: 1200,
      temperature: parsed.data.mode === "tighten" ? 0.4 : 0.7,
    });

    if (!raw) {
      return NextResponse.json({ ok: true, drafted: false });
    }

    const valid = copySchema.safeParse(extractJsonObject(raw));
    if (!valid.success || (!valid.data.tagline.trim() && !valid.data.description.trim())) {
      Sentry.captureException(new Error("Copy draft JSON failed validation"), {
        tags: { route: "admin-draft-copy", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return NextResponse.json(
        { error: "Couldn't read the draft — please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, drafted: true, copy: valid.data });
  } catch (err) {
    console.error("[admin] draft-copy error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-draft-copy", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't draft right now — please try again." },
      { status: 502 },
    );
  }
}
