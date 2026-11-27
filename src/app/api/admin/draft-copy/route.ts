// POST /api/admin/draft-copy: owner-only. Drafts website copy for review in
// Studio: a journal post from a topic (title, excerpt, body, tags), or a
// service or portfolio page's tagline, description and intro from its live
// copy. Never publishes and never reads client data, since all of it goes on
// the public site. No-ops (`drafted: false`) without a key, or for a page the
// site doesn't show.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { AVOID_LINE, NO_EM_DASHES } from "@/lib/ai/ai-voice";
import { getService, getPortfolio } from "@/lib/content";

const page = {
  slug: z.string().min(1).max(100),
  mode: z.enum(["tighten", "rewrite", "fresh"]),
  angle: z.string().max(500).optional(),
};

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("service"), ...page }),
  z.object({ kind: z.literal("portfolio"), ...page }),
  z.object({
    kind: z.literal("journal"),
    topic: z.string().trim().min(1).max(2000),
    postType: z.string().trim().max(80).optional(),
  }),
]);

const copySchema = z.object({
  tagline: z.string().max(300).default(""),
  description: z.string().max(800).default(""),
  intro: z.array(z.string().max(2000)).max(8).default([]),
});

const postSchema = z.object({
  title: z.string().max(200),
  excerpt: z.string().max(600).default(""),
  body: z.string().max(20000),
  tags: z.array(z.string().max(60)).max(12).default([]),
});

const MODE_INSTRUCTION: Record<string, string> = {
  tighten:
    "Keep the existing meaning and Julian's voice; make it crisper, tighter, and more compelling. Cut filler; don't change the offering.",
  rewrite:
    "Rewrite the copy fresh while keeping the same offering and facts. Vary the structure and phrasing from the current version.",
  fresh:
    "Draft this copy from scratch for the subject, based on its title and the angle (the current copy is thin or missing).",
};

const PAGE_PROMPT = [
  "You are helping Julian Perez, a wedding and portrait photographer in the DMV (DC, Maryland, Virginia), write the marketing copy for a page on his website. Write in his voice: warm, genuine, and confident without hype; benefit-focused and specific, never generic or salesy. Speak to the prospective client.",
  "",
  "Use ONLY the facts in the current copy and the page's subject. Never invent prices, package names, specific statistics, or claims that aren't supported by what you're given.",
  "",
  `${AVOID_LINE} ${NO_EM_DASHES}`,
  "",
  "Return STRICT JSON and nothing else:",
  "{",
  '  "tagline": "a short, punchy one-line tagline (<= 80 characters)",',
  '  "description": "a 1-2 sentence summary for the page header and listings (<= 240 characters)",',
  '  "intro": ["1-3 short philosophy / benefit paragraphs shown above the packages"]',
  "}",
  'For a portfolio page, "intro" may be an empty array.',
].join("\n");

const JOURNAL_PROMPT = [
  "You are Julian Perez, a wedding and portrait photographer based in the DMV (DC, Maryland, Virginia), writing a post for the journal on your own website. Write in your own warm, genuine, documentary-minded voice: personal and grounded, never generic or salesy.",
  "",
  "Work from the topic you're given, plus general non-fabricated knowledge. NEVER invent specific client names, prices, statistics, dates, or quotes. If a specific detail would strengthen the post but isn't provided, write around it or leave a short [bracket] for Julian to fill in.",
  "",
  "Structure it like a real blog post: an inviting opening, a few short well-paced paragraphs of substance, and a natural closing. Keep paragraphs short and readable. Plain prose only, with no markdown symbols or heading syntax (Julian formats in his editor).",
  "",
  `${AVOID_LINE} ${NO_EM_DASHES}`,
  "",
  "Return STRICT JSON and nothing else:",
  "{",
  '  "title": "a specific, inviting post title (<= 110 characters)",',
  '  "excerpt": "a 1-2 sentence teaser for the index and social cards (<= 270 characters)",',
  '  "body": "the full post as plain prose, paragraphs separated by a blank line",',
  '  "tags": ["3-6 short lowercase keyword tags"]',
  "}",
].join("\n");

// A draft the model returned that doesn't read as the JSON asked for.
function unreadable(kind: string) {
  Sentry.captureException(new Error(`${kind === "journal" ? "Journal" : "Copy"} draft JSON failed validation`), {
    tags: { route: "admin/draft-copy", stage: "parse", kind, model: aiModel() },
    level: "warning",
  });
  return apiError(502, "Couldn't read the draft. Try again.");
}

export const POST = defineRoute({
  route: "admin/draft-copy",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't draft right now. Try again." },
  tags: (data) => ({ model: aiModel(), kind: data.kind }),
  run: async (data) => {
    if (!aiEnabled()) return { ok: true, drafted: false };

    if (data.kind === "journal") {
      const raw = await generateText({
        system: JOURNAL_PROMPT,
        prompt: [
          `Post type: ${data.postType || "your choice"}`,
          "Topic / brief:",
          '"""',
          data.topic,
          '"""',
          "",
          "Write the journal post now.",
        ].join("\n"),
        maxTokens: 2000,
        temperature: 0.7,
      });
      if (!raw) return { ok: true, drafted: false };
      const valid = postSchema.safeParse(extractJsonObject(raw));
      if (!valid.success || !valid.data.title.trim() || !valid.data.body.trim()) return unreadable(data.kind);
      return { ok: true, drafted: true, post: valid.data };
    }

    // Resolve the live copy server-side (pages the site shows only).
    const subject = data.kind === "service" ? await getService(data.slug) : await getPortfolio(data.slug);
    if (!subject) return { ok: true, drafted: false };

    const current = subject as {
      title?: string;
      tagline?: string;
      description?: string;
      intro?: string[];
    };
    const prompt = [
      `Subject: ${current.title ?? data.slug} (${data.kind} page)`,
      data.angle?.trim() ? `Angle / emphasis: ${data.angle.trim()}` : "",
      "",
      "Current copy:",
      `- Tagline: ${current.tagline || "(none)"}`,
      `- Description: ${current.description || "(none)"}`,
      `- Intro: ${current.intro?.length ? current.intro.join("\n\n") : "(none)"}`,
      "",
      MODE_INSTRUCTION[data.mode],
      "",
      "Write the improved copy now.",
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await generateText({
      system: PAGE_PROMPT,
      prompt,
      maxTokens: 1200,
      temperature: data.mode === "tighten" ? 0.4 : 0.7,
    });
    if (!raw) return { ok: true, drafted: false };

    const valid = copySchema.safeParse(extractJsonObject(raw));
    if (!valid.success || (!valid.data.tagline.trim() && !valid.data.description.trim())) {
      return unreadable(data.kind);
    }
    return { ok: true, drafted: true, copy: valid.data };
  },
});
