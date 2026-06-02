// GET /admin/verify?token=… — admin magic-link landing. Verifies the token
// (which re-checks the ADMIN_EMAIL allowlist), sets the admin session cookie,
// and redirects into the dashboard. Failures return to the admin login.

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminMagicToken } from "@/lib/auth";
import { setAdminSessionCookie } from "@/lib/auth-cookies";
import * as Sentry from "@sentry/nextjs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const loginUrl = new URL("/admin", req.nextUrl.origin);

  if (!token) {
    loginUrl.searchParams.set("error", "missing-link");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const claims = await verifyAdminMagicToken(token);
    if (!claims) {
      loginUrl.searchParams.set("error", "invalid-link");
      return NextResponse.redirect(loginUrl);
    }
    await setAdminSessionCookie(claims.email);
    return NextResponse.redirect(new URL("/admin/projects", req.nextUrl.origin));
  } catch (err) {
    console.error("[admin] verify error:", err);
    Sentry.captureException(err, { tags: { route: "admin-verify" } });
    loginUrl.searchParams.set("error", "invalid-link");
    return NextResponse.redirect(loginUrl);
  }
}
