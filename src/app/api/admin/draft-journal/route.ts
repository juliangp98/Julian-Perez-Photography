// POST /api/admin/draft-journal — owner-only. Drafts a journal post (title,
// excerpt, body, tags) from a topic/brief in Julian's voice, for him to refine
// and publish in Sanity Studio. The AI never publishes — it drafts the text
// fields; Julian adds the required cover image + publish date in Studio (and an
// AI can't supply a photo anyway). Topic-driven only — it never pulls private
// client data, since the journal is public.
//
// No-ops gracefully (`drafted: false`) when AI isn't configured.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  topic: z.string().min(1).max(2000),
  postType: z.string().max(80).optional(),
});

const postSchema = z.object({
  title: z.string().max(200),
  excerpt: z.string().max(600).default(""),
  body: z.string().max(20000),
  tags: z.array(z.string().max(60)).max(12).default([]),
});

const SYSTEM_PROMPT = [
  "You are Julian Perez, a wedding and portrait photographer based in the DMV (DC, Maryland, Virginia), writing a post for the journal on your own website. Write in your own warm, genuine, documentary-minded voice — personal and grounded, never generic or salesy.",
  "",
  "Work from the topic you're given, plus general non-fabricated knowledge. NEVER invent specific client names, prices, statistics, dates, or quotes. If a specific detail would strengthen the post but isn't provided, write around it or leave a short [bracket] for Julian to fill in.",
  "",
  "Structure it like a real blog post: an inviting opening, a few short well-paced paragraphs of substance, and a natural closing. Keep paragraphs short and readable. Plain prose only — no markdown symbols or heading syntax (Julian formats in his editor).",
  "",
  "Return STRICT JSON and nothing else:",
  "{",
  '  "title": "a specific, inviting post title (<= 110 characters)",',
  '  "excerpt": "a 1-2 sentence teaser for the index and social cards (<= 270 characters)",',
  '  "body": "the full post as plain prose, paragraphs separated by a blank line",',
  '  "tags": ["3-6 short lowercase keyword tags"]',
  "}",
].join("\n");

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-draft-journal",
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

  try {
    const prompt = [
      `Post type: ${parsed.data.postType?.trim() || "your choice"}`,
      "Topic / brief:",
      '"""',
      parsed.data.topic.trim(),
      '"""',
      "",
      "Write the journal post now.",
    ].join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 2000,
      temperature: 0.7,
    });

    if (!raw) {
      return NextResponse.json({ ok: true, drafted: false });
    }

    const valid = postSchema.safeParse(extractJsonObject(raw));
    if (!valid.success || !valid.data.title.trim() || !valid.data.body.trim()) {
      Sentry.captureException(new Error("Journal draft JSON failed validation"), {
        tags: { route: "admin-draft-journal", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return NextResponse.json(
        { error: "Couldn't read the draft — please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, drafted: true, post: valid.data });
  } catch (err) {
    console.error("[admin] draft-journal error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-draft-journal", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't draft right now — please try again." },
      { status: 502 },
    );
  }
}
