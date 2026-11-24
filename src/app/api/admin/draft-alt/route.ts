// POST /api/admin/draft-alt: owner-only. Drafts alt text for one image in a named
// gallery with the vision model; the result is returned for review, never saved.
// No-ops (`drafted: false`) without a key or when the src isn't in that gallery.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute, originOf } from "@/lib/api-route";
import { describeImage, aiEnabled, visionModel } from "@/lib/ai/ai";
import { getPortfolio } from "@/lib/content";

const schema = z.object({
  slug: z.string().min(1).max(100),
  src: z.string().min(1).max(300),
});

const SYSTEM_PROMPT =
  "You write concise image alt text for accessibility on a photographer's portfolio website. Describe what is visibly in the photograph in one natural phrase, under 125 characters. Do not start with 'image of' / 'photo of' / 'picture of'. Return only the alt text — no quotes, no label.";

export const POST = defineRoute({
  route: "admin/draft-alt",
  auth: "admin",
  schema,
  rateLimit: { max: 30, windowMs: 60_000 },
  failure: { status: 502, error: "Couldn't generate alt text right now. Try again." },
  tags: () => ({ model: visionModel() }),
  run: async ({ slug, src }, { req }) => {
    // The src must belong to the named gallery (validated before any provider call).
    const portfolio = await getPortfolio(slug);
    const inGallery = portfolio?.images?.some((img) => img.src === src);
    if (!portfolio || !inGallery) return { ok: true, drafted: false };

    if (!aiEnabled()) return { ok: true, drafted: false };

    // Studio-uploaded gallery images are absolute cdn.sanity.io URLs; Lightroom
    // manifest images are site-relative paths that need the origin prefixed.
    const imgUrl = /^https?:\/\//i.test(src) ? src : `${originOf(req)}${src}`;
    const imgRes = await fetch(imgUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!imgRes.ok) return { ok: true, drafted: false };
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
    if (!alt) return { ok: true, drafted: false };

    return { ok: true, drafted: true, alt };
  },
});
