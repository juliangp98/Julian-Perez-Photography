// POST /api/admin/draft-alt — owner-only. Generates accessibility alt text for
// ONE portfolio image with the vision model. Validates the image belongs to the
// named gallery, fetches it server-side, and describes it. The AI never
// publishes — the result is returned for review (and saved via /save-alt).
//
// Per-image (not a batch) to keep each request bounded. No-ops (`drafted: false`)
// without a key, for an unknown gallery, or a src that isn't in that gallery.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { describeImage, aiEnabled, visionModel } from "@/lib/ai/ai";
import { getPortfolio } from "@/lib/content";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  slug: z.string().min(1).max(100),
  src: z.string().min(1).max(300),
});

const SYSTEM_PROMPT =
  "You write concise image alt text for accessibility on a photographer's portfolio website. Describe what is visibly in the photograph in one natural phrase, under 125 characters. Do not start with 'image of' / 'photo of' / 'picture of'. Return only the alt text — no quotes, no label.";

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-draft-alt",
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

  // The src must belong to the named gallery (validated before any provider call).
  const portfolio = await getPortfolio(parsed.data.slug);
  const inGallery = portfolio?.images?.some(
    (img) => img.src === parsed.data.src,
  );
  if (!portfolio || !inGallery) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  if (!aiEnabled()) {
    return NextResponse.json({ ok: true, drafted: false });
  }

  try {
    const origin = req.headers.get("origin") || new URL(req.url).origin;
    const imgRes = await fetch(`${origin}${parsed.data.src}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!imgRes.ok) {
      return NextResponse.json({ ok: true, drafted: false });
    }
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;

    const raw = await describeImage({
      system: SYSTEM_PROMPT,
      prompt: "Write alt text for this photograph.",
      imageDataUrl: dataUrl,
      maxTokens: 120,
    });
    const alt = raw
      ?.trim()
      .replace(/^["'“]+|["'”]+$/g, "")
      .trim();
    if (!alt) {
      return NextResponse.json({ ok: true, drafted: false });
    }

    return NextResponse.json({ ok: true, drafted: true, alt });
  } catch (err) {
    console.error("[admin] draft-alt error:", err);
    Sentry.captureException(err, {
      tags: { route: "admin-draft-alt", stage: "generate", model: visionModel() },
    });
    return NextResponse.json(
      { error: "Couldn't generate alt text right now — please try again." },
      { status: 502 },
    );
  }
}
