// Edge middleware gating the authenticated client portal.
//
// `/portal` (login) and `/portal/verify` (magic-link landing that SETS the
// session) are public; every other `/portal/*` page requires a valid session
// cookie. The cookie is read off the request and verified with the pure
// `jose` helper in `src/lib/auth.ts` (Edge-safe — no `next/headers`).
//
// API routes under `/api/portal/*` are intentionally NOT matched here: the
// request-link route is public, and the update/upload routes verify the
// session themselves server-side.

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin area (owner only) ──
  if (pathname.startsWith("/admin")) {
    // Login + magic-link landing are public.
    if (pathname === "/admin" || pathname.startsWith("/admin/verify")) {
      return NextResponse.next();
    }
    const adminToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const adminSession = adminToken
      ? await verifyAdminSessionToken(adminToken)
      : null;
    if (!adminSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Client portal ──
  // Public entry points within the portal.
  if (pathname === "/portal" || pathname.startsWith("/portal/verify")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/portal";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
