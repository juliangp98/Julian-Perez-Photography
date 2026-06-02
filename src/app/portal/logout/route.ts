// POST /portal/logout — clears the session cookie and returns to the login
// page. Reachable only with a valid session (the proxy gates /portal/*).
//
// POST-only on purpose: signing out mutates state, so it must be a deliberate
// action and never something a link prefetch can trigger. Prefetches are always
// GET requests, so a POST-only route is immune to them (a prefetch GET here
// simply gets 405, leaving the session intact).

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth-cookies";

export async function POST(req: NextRequest) {
  await clearSessionCookie();
  // 303 so the browser follows with a GET (not a re-POST) to the login page.
  return NextResponse.redirect(new URL("/portal", req.nextUrl.origin), 303);
}
