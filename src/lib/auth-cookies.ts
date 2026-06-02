// Session-cookie helpers for the client portal. These use `next/headers`
// `cookies()` to read/write the cookie jar from Server Components and route
// handlers. The `proxy` gate instead reads the cookie off `NextRequest`
// directly and verifies it with the pure helpers in `auth.ts`.

import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
  signAdminSessionToken,
  verifyAdminSessionToken,
  type SessionClaims,
  type AdminClaims,
} from "@/lib/auth";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches the token TTL.

const COOKIE_OPTS = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function setSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await signSessionToken(claims);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, COOKIE_OPTS);
}

export async function getSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// ── Admin session ──

export async function setAdminSessionCookie(email: string): Promise<void> {
  const token = await signAdminSessionToken(email);
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, token, COOKIE_OPTS);
}

export async function getAdminSession(): Promise<AdminClaims | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
}
