// POST /api/admin/draft-journal: owner-only. Drafts a journal post's text fields
// from a topic for review in Studio. Never publishes and never reads client data,
// since the journal is public; no-ops (`drafted: false`) without a key.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";

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

export const POST = defineRoute({
  route: "admin/draft-journal",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't draft right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data) => {
    if (!aiEnabled()) return { ok: true, drafted: false };

    const prompt = [
      `Post type: ${data.postType?.trim() || "your choice"}`,
      "Topic / brief:",
      '"""',
      data.topic.trim(),
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

    if (!raw) return { ok: true, drafted: false };

    const valid = postSchema.safeParse(extractJsonObject(raw));
    if (!valid.success || !valid.data.title.trim() || !valid.data.body.trim()) {
      Sentry.captureException(new Error("Journal draft JSON failed validation"), {
        tags: { route: "admin/draft-journal", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return apiError(502, "Couldn't read the draft. Try again.");
    }

    return { ok: true, drafted: true, post: valid.data };
  },
});
