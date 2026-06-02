// POST /api/portal/bundle — client links/unlinks their own projects into a
// bundle. Ownership is enforced in the helpers (any id not belonging to the
// signed-in email is dropped), so a client can only ever bundle their own
// projects.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitResponse } from "@/lib/request-guard";
import { getSession } from "@/lib/auth-cookies";
import { setBundleForEmail, clearBundleForEmail } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    projectIds: z.array(z.string().min(1)).min(2).max(20),
    label: z.string().min(1).max(100),
  }),
  z.object({ action: z.literal("unlink"), projectId: z.string().min(1) }),
]);

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, {
    key: "portal-bundle",
    max: 30,
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

  try {
    if (parsed.data.action === "link") {
      await setBundleForEmail(
        session.email,
        parsed.data.projectIds,
        parsed.data.label,
      );
    } else {
      await clearBundleForEmail(session.email, parsed.data.projectId);
    }
  } catch (err) {
    console.error("[portal] bundle error:", err);
    Sentry.captureException(err, { tags: { route: "portal-bundle" } });
    return NextResponse.json(
      { error: "Couldn't update — please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
