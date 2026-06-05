// POST /api/admin/save-alt — owner-only. Persists a reviewed alt-text override
// for one portfolio image to Supabase, where it overlays the manifest baseline
// at render and survives photo re-imports. No-ops (`saved: false`) when the
// override store isn't configured.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { setPortfolioAlt } from "@/lib/portfolio-alt";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  src: z.string().min(1).max(300),
  alt: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-save-alt",
    max: 60,
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

  try {
    const saved = await setPortfolioAlt(parsed.data.src, parsed.data.alt.trim());
    return NextResponse.json({ ok: true, saved });
  } catch (err) {
    console.error("[admin] save-alt error:", err);
    Sentry.captureException(err, { tags: { route: "admin-save-alt" } });
    return NextResponse.json(
      { error: "Couldn't save — please try again." },
      { status: 500 },
    );
  }
}
