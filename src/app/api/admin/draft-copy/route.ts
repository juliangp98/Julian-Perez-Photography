// POST /api/admin/draft-copy: owner-only. Drafts or tightens a service or portfolio
// page's tagline, description and intro from its live copy, for review in Studio.
// Never publishes; no-ops (`drafted: false`) without a key or an unknown subject.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import { generateText, aiEnabled, aiModel, extractJsonObject } from "@/lib/ai/ai";
import { getService, getPortfolio } from "@/lib/content";

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
    "Keep the existing meaning and Julian's voice; make it crisper, tighter, and more compelling. Cut filler; don't change the offering.",
  rewrite:
    "Rewrite the copy fresh while keeping the same offering and facts. Vary the structure and phrasing from the current version.",
  fresh:
    "Draft this copy from scratch for the subject, based on its title and the angle (the current copy is thin or missing).",
};

const SYSTEM_PROMPT_BASE = [
  "You are helping Julian Perez, a wedding and portrait photographer in the DMV (DC, Maryland, Virginia), write the marketing copy for a page on his website. Write in his voice: warm, genuine, and confident without hype; benefit-focused and specific, never generic or salesy. Speak to the prospective client.",
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

export const POST = defineRoute({
  route: "admin/draft-copy",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't draft right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data) => {
    if (!aiEnabled()) return { ok: true, drafted: false };

    // Resolve the live copy server-side.
    const subject =
      data.kind === "service"
        ? await getService(data.slug)
        : await getPortfolio(data.slug);
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
      system: SYSTEM_PROMPT_BASE,
      prompt,
      maxTokens: 1200,
      temperature: data.mode === "tighten" ? 0.4 : 0.7,
    });

    if (!raw) return { ok: true, drafted: false };

    const valid = copySchema.safeParse(extractJsonObject(raw));
    if (!valid.success || (!valid.data.tagline.trim() && !valid.data.description.trim())) {
      Sentry.captureException(new Error("Copy draft JSON failed validation"), {
        tags: { route: "admin/draft-copy", stage: "parse", model: aiModel() },
        level: "warning",
      });
      return apiError(502, "Couldn't read the draft. Try again.");
    }

    return { ok: true, drafted: true, copy: valid.data };
  },
});
