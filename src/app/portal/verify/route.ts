// GET /portal/verify?token=… — the magic-link landing. Verifies the one-time
// token, confirms the record still exists, sets the session cookie, and
// redirects into the portal. Any failure redirects back to the login page with
// a friendly error flag (never an error page).

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { verifyMagicToken } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookies";
import { getClientById } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const loginUrl = new URL("/portal", req.nextUrl.origin);

  if (!token) {
    loginUrl.searchParams.set("error", "missing-link");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const claims = await verifyMagicToken(token);
    if (!claims) {
      loginUrl.searchParams.set("error", "invalid-link");
      return NextResponse.redirect(loginUrl);
    }

    // Confirm the record still exists (and the store is reachable) before
    // issuing a session.
    const record = await getClientById(claims.recordId);
    if (!record) {
      loginUrl.searchParams.set("error", "invalid-link");
      return NextResponse.redirect(loginUrl);
    }

    await setSessionCookie({ recordId: claims.recordId, email: claims.email });
    return NextResponse.redirect(
      new URL("/portal/dashboard", req.nextUrl.origin),
    );
  } catch (err) {
    console.error("[portal] verify error:", err);
    Sentry.captureException(err, { tags: { route: "portal-verify" } });
    loginUrl.searchParams.set("error", "invalid-link");
    return NextResponse.redirect(loginUrl);
  }
}
