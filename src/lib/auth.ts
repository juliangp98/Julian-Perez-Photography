// Pure JWT helpers for the client portal — magic-link tokens and session
// tokens, both HS256-signed with `AUTH_SECRET`. Intentionally free of
// `next/headers` so this module is safe to import from Edge middleware as well
// as Node route handlers. Cookie read/write helpers live in `auth-cookies.ts`
// (Node/server only) so middleware never pulls `cookies()` into the Edge
// bundle.
//
// No `server-only` marker here: middleware runs in the Edge runtime and this
// module must bundle there. `AUTH_SECRET` is a non-public env var, so it never
// reaches the browser regardless; portal code never imports this client-side.

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "jpp_portal_session";

// Magic links are short-lived and single-use-by-expiry; sessions are long.
const MAGIC_TTL = "20m";
const SESSION_TTL = "30d";

export type SessionClaims = { recordId: string; email: string };

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is not set (or is too short).");
  }
  return new TextEncoder().encode(s);
}

export function isAuthConfigured(): boolean {
  const s = process.env.AUTH_SECRET;
  return typeof s === "string" && s.length >= 16;
}

async function sign(
  claims: SessionClaims,
  purpose: "magic" | "session",
  ttl: string,
): Promise<string> {
  return new SignJWT({ ...claims, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretKey());
}

async function verify(
  token: string,
  purpose: "magic" | "session",
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== purpose) return null;
    if (
      typeof payload.recordId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return { recordId: payload.recordId, email: payload.email };
  } catch {
    return null;
  }
}

export const signMagicToken = (c: SessionClaims) => sign(c, "magic", MAGIC_TTL);
export const verifyMagicToken = (t: string) => verify(t, "magic");
export const signSessionToken = (c: SessionClaims) =>
  sign(c, "session", SESSION_TTL);
export const verifySessionToken = (t: string) => verify(t, "session");
