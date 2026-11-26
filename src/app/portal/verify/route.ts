// GET /portal/verify?token=… — the magic-link landing. Verifies the one-time
// token, confirms the record still exists, sets the session cookie, and
// redirects into the portal: to the page the link was asked for from, else
// straight to the project when the person has just one, else to their
// projects. Any failure redirects back to the login page with a friendly
// error flag (never an error page).

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { expiredMagicReturnPath, verifyMagicToken } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookies";
import { emailHasPortalAccess, listPortalProjects } from "@/lib/clients";
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
      // A link that only ran out keeps its page for the fresh one.
      const from = await expiredMagicReturnPath(token);
      if (from) loginUrl.searchParams.set("from", from);
      return NextResponse.redirect(loginUrl);
    }

    // Confirm the email still has portal access — as an owner or a project
    // collaborator (and the store is reachable) — before issuing a session.
    const hasAccess = await emailHasPortalAccess(claims.email);
    if (!hasAccess) {
      loginUrl.searchParams.set("error", "invalid-link");
      return NextResponse.redirect(loginUrl);
    }

    await setSessionCookie({ email: claims.email });
    let landing = claims.next;
    if (!landing) {
      // Signed in by now: a failed lookup only means the list opens.
      try {
        const projects = await listPortalProjects(claims.email);
        landing = projects.length === 1 ? `/portal/projects/${projects[0].id}` : "/portal/dashboard";
      } catch (err) {
        Sentry.captureException(err, { tags: { route: "portal-verify", stage: "landing" }, level: "warning" });
        landing = "/portal/dashboard";
      }
    }
    return NextResponse.redirect(new URL(landing, req.nextUrl.origin));
  } catch (err) {
    console.error("[portal] verify error:", err);
    Sentry.captureException(err, { tags: { route: "portal-verify", stage: "verify" } });
    loginUrl.searchParams.set("error", "invalid-link");
    return NextResponse.redirect(loginUrl);
  }
}
