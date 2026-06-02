// Proxy (Next.js 16) gating the authenticated client portal + owner admin area.
//
// In Next.js 16 the former `middleware` convention is renamed to `proxy`, and
// it runs on the **Node.js runtime** (the Edge runtime is not supported here).
// Running in the same runtime as the page renderers keeps cookie handling
// consistent across full-page loads and client-side (RSC) navigations.
//
// `/portal` (login) + `/portal/verify`, and `/admin` (login) + `/admin/verify`
// (the magic-link landings that SET the session) are public; every other
// `/portal/*` and `/admin/*` route requires a valid session cookie. The cookie
// is read off the request and verified with the pure `jose` helpers in
// `src/lib/auth.ts`.
//
// API routes under `/api/*` are intentionally NOT matched here: the public
// request-link routes need to stay open, and the mutation routes verify the
// session themselves server-side.

import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
  verifyAdminSessionToken,
} from "@/lib/auth";

export async function proxy(req: NextRequest) {
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
