// POST /api/admin/delete-project — owner-only. Permanently deletes one project
// row. Gated to the admin session; this is Julian removing his own records. The
// store no-ops cleanly when unconfigured, so the call is always safe to make.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { deleteClient } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({ projectId: z.string().min(1).max(100) });

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-delete-project",
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

  try {
    await deleteClient(parsed.data.projectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin] delete-project error:", err);
    Sentry.captureException(err, { tags: { route: "admin-delete-project" } });
    return NextResponse.json(
      { error: "Couldn't delete — please try again." },
      { status: 500 },
    );
  }
}
