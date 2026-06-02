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
export const ADMIN_SESSION_COOKIE = "jpp_admin_session";

// Magic links are short-lived and single-use-by-expiry; sessions are long.
const MAGIC_TTL = "20m";
const SESSION_TTL = "30d";

// The portal session is keyed by the person's email. A person can have several
// projects; the portal lists + authorizes them by this email (project ids come
// from the DB scoped to the email, never from the token).
export type SessionClaims = { email: string };

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
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export const signMagicToken = (c: SessionClaims) => sign(c, "magic", MAGIC_TTL);
export const verifyMagicToken = (t: string) => verify(t, "magic");
export const signSessionToken = (c: SessionClaims) =>
  sign(c, "session", SESSION_TTL);
export const verifySessionToken = (t: string) => verify(t, "session");

// ── Admin auth ──
//
// The owner-only admin area (`/admin`) uses the same magic-link mechanism but a
// distinct purpose + cookie, and is restricted to the configured `ADMIN_EMAIL`
// (comma-separated for more than one). Admin tokens carry only the email — no
// record id; the admin sees every record.

export type AdminClaims = { email: string };

export function isAdminEmail(email: string): boolean {
  const allowed = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export function isAdminConfigured(): boolean {
  return isAuthConfigured() && (process.env.ADMIN_EMAIL || "").trim().length > 0;
}

async function signAdmin(
  email: string,
  purpose: "admin-magic" | "admin-session",
  ttl: string,
): Promise<string> {
  return new SignJWT({ email, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretKey());
}

async function verifyAdmin(
  token: string,
  purpose: "admin-magic" | "admin-session",
): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== purpose) return null;
    if (typeof payload.email !== "string") return null;
    // Re-check the allowlist on every verify, so removing an email from
    // ADMIN_EMAIL revokes access even on an unexpired token.
    if (!isAdminEmail(payload.email)) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export const signAdminMagicToken = (email: string) =>
  signAdmin(email, "admin-magic", MAGIC_TTL);
export const verifyAdminMagicToken = (t: string) => verifyAdmin(t, "admin-magic");
export const signAdminSessionToken = (email: string) =>
  signAdmin(email, "admin-session", SESSION_TTL);
export const verifyAdminSessionToken = (t: string) =>
  verifyAdmin(t, "admin-session");
