// Session-cookie helpers for the client portal (Node/server runtime only —
// uses `next/headers` `cookies()`, which is unavailable in Edge middleware).
// Middleware reads the cookie off `NextRequest` directly and verifies it with
// the pure helpers in `auth.ts`.

import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
  type SessionClaims,
} from "@/lib/auth";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches the token TTL.

export async function setSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await signSessionToken(claims);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
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
