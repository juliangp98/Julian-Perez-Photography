// POST /api/admin/save-alt: owner-only. Saves a reviewed alt-text override for
// one portfolio image, which overlays the manifest at render and survives
// re-imports. Answers `saved: false` when the override store isn't configured.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { setPortfolioAlt } from "@/lib/portfolio-alt";

const schema = z.object({
  src: z.string().min(1).max(300),
  alt: z.string().min(1).max(500),
});

export const POST = defineRoute({
  route: "admin/save-alt",
  auth: "admin",
  schema,
  rateLimit: { max: 60, windowMs: 60_000 },
  failure: { status: 500, error: "Couldn't save. Try again." },
  run: async ({ src, alt }) => {
    const saved = await setPortfolioAlt(src, alt.trim());
    return { ok: true, saved };
  },
});
