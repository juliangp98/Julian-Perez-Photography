// POST /admin/logout — clears the admin session and returns to the admin login.
//
// POST-only on purpose: signing out mutates state, so it must be a deliberate
// action and never something a link prefetch can trigger. Prefetches are always
// GET requests, so a POST-only route is immune to them (a prefetch GET here
// simply gets 405, leaving the session intact).

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth-cookies";

export async function POST(req: NextRequest) {
  await clearAdminSessionCookie();
  // 303 so the browser follows with a GET (not a re-POST) to the login page.
  return NextResponse.redirect(new URL("/admin", req.nextUrl.origin), 303);
}
