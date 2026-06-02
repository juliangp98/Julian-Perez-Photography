// GET /admin/logout — clears the admin session and returns to the admin login.

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { clearAdminSessionCookie } from "@/lib/auth-cookies";

export async function GET(req: NextRequest) {
  await clearAdminSessionCookie();
  return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
}
