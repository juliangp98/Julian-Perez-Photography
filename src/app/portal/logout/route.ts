// GET /portal/logout — clears the session cookie and returns to the login
// page. Reachable only with a valid session (the proxy gates /portal/*).

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth-cookies";

export async function GET(req: NextRequest) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
}
