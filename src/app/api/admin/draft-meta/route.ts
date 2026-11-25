// POST /api/admin/draft-meta: owner-only. Drafts an SEO meta description for one
// of the site's key static pages; those metas live in code, so it is for review only.
// No-ops (`drafted: false`) for an unknown page key or without a key.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { generateText, aiEnabled, aiModel } from "@/lib/ai/ai";
import { getSeoPage } from "@/lib/seo-pages";
import { getSiteSettings } from "@/lib/content";

const schema = z.object({
  page: z.string().min(1).max(60),
  angle: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = [
  "You write SEO meta descriptions for the website of Julian Perez, a wedding, portrait, and event photographer based in the DMV (DC, Maryland, Virginia). A meta description is the snippet shown under a page's title in search results.",
  "",
  "Write ONE meta description for the page described. Make it compelling and specific, around 150-160 characters and NEVER over 160, naturally including the most relevant terms (what the page is, plus the location where it fits), and write it to earn the click. Use only the facts given — never invent services, prices, or claims.",
  "",
  "Return ONLY the description text — no quotation marks, no markdown, no label, nothing else.",
].join("\n");

export const POST = defineRoute({
  route: "admin/draft-meta",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't draft right now. Try again." },
  tags: () => ({ model: aiModel() }),
  run: async (data) => {
    const page = getSeoPage(data.page);
    if (!page) return { ok: true, drafted: false };

    if (!aiEnabled()) return { ok: true, drafted: false };

    const settings = await getSiteSettings();
    const prompt = [
      `Site: ${settings.siteName}${settings.tagline ? ` — ${settings.tagline}` : ""}.`,
      settings.coverageArea ? `Coverage area: ${settings.coverageArea}.` : "",
      `Page: ${page.label} (${page.path})`,
      `Purpose: ${page.purpose}`,
      data.angle?.trim() ? `Emphasis: ${data.angle.trim()}` : "",
      "",
      "Write the meta description now.",
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await generateText({
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 160,
      temperature: 0.6,
    });

    const meta = raw
      ?.trim()
      .replace(/^["'“]+|["'”]+$/g, "")
      .trim();
    if (!meta) return { ok: true, drafted: false };

    return { ok: true, drafted: true, meta };
  },
});
