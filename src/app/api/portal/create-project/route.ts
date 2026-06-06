// POST /api/portal/create-project — a signed-in client starts a new project for
// their OWN email (taken from the session, never the body). Without `force`, it
// warns when an email+service duplicate exists; the client may still create a
// second. The stub starts at new-inquiry, like an inquiry would.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth-cookies";
import { rateLimitResponse } from "@/lib/request-guard";
import { createProjectManual, findDuplicateProject } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  serviceType: z.string().max(100).optional(),
  eventDate: z.string().max(100).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, {
    key: "portal-create-project",
    max: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

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
  const { force, serviceType, eventDate } = parsed.data;

  try {
    if (!force) {
      const dup = await findDuplicateProject(session.email, serviceType);
      if (dup) return NextResponse.json({ ok: true, duplicate: dup });
    }
    const id = await createProjectManual({
      email: session.email,
      serviceType,
      eventDate,
      source: "manual-client",
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[portal] create-project error:", err);
    Sentry.captureException(err, { tags: { route: "portal-create-project" } });
    return NextResponse.json(
      { error: "Couldn't create — please try again." },
      { status: 500 },
    );
  }
}
