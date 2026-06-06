// POST /api/admin/create-project — owner-only. Creates a project stub from
// whatever info Julian has. Without `force`, it warns when an email+service
// duplicate already exists (he can still create a second by re-sending force).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { createProjectManual, findDuplicateProject } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  email: z.string().email(),
  clientName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  serviceType: z.string().max(100).optional(),
  eventDate: z.string().max(100).optional(),
  package: z.string().max(200).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const limited = rateLimitResponse(req, {
    key: "admin-create-project",
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
  const { force, ...input } = parsed.data;

  try {
    if (!force) {
      const dup = await findDuplicateProject(input.email, input.serviceType);
      if (dup) return NextResponse.json({ ok: true, duplicate: dup });
    }
    const id = await createProjectManual({ ...input, source: "manual-admin" });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[admin] create-project error:", err);
    Sentry.captureException(err, { tags: { route: "admin-create-project" } });
    return NextResponse.json(
      { error: "Couldn't create — please try again." },
      { status: 500 },
    );
  }
}
