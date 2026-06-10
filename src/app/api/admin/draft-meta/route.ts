// POST /api/admin/draft-meta — owner-only. Drafts an SEO meta description
// (~150-160 chars) for one of the site's key static/index pages, from the page's
// purpose + site settings. The AI never publishes — these metas live in code, so
// the output is for review and applying to the page's `metadata.description`.
//
// No-ops gracefully (`drafted: false`) when AI isn't configured or the page key
// isn't recognized.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { generateText, aiEnabled, aiModel } from "@/lib/ai/ai";
import { getSeoPage } from "@/lib/seo-pages";
import { getSiteSettings } from "@/lib/content";
import * as Sentry from "@sentry/nextjs";

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

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-draft-meta",
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

  const page = getSeoPage(parsed.data.page);
  if (!page) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  if (!aiEnabled()) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  try {
    const settings = await getSiteSettings();
    const prompt = [
      `Site: ${settings.siteName}${settings.tagline ? ` — ${settings.tagline}` : ""}.`,
      settings.coverageArea ? `Coverage area: ${settings.coverageArea}.` : "",
      `Page: ${page.label} (${page.path})`,
      `Purpose: ${page.purpose}`,
      parsed.data.angle?.trim() ? `Emphasis: ${parsed.data.angle.trim()}` : "",
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
    if (!meta) {
      return NextResponse.json({ ok: true, drafted: false });
    }

    return NextResponse.json({ ok: true, drafted: true, meta });
  } catch (err) {
    console.error("[admin] draft-meta error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-draft-meta", stage: "generate", model: aiModel() },
    });
    return NextResponse.json(
      { error: "Couldn't draft right now — please try again." },
      { status: 502 },
    );
  }
}
