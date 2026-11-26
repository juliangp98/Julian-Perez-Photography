// Pure JWT helpers for the client portal — magic-link tokens and session
// tokens, both HS256-signed with `AUTH_SECRET`. Kept free of `next/headers` so
// the token sign/verify logic stays a small, dependency-light unit usable from
// the `proxy` gate and the route handlers alike. Cookie read/write helpers live
// in `auth-cookies.ts` (they use `next/headers` `cookies()`), keeping this
// module's concern limited to the tokens themselves.
//
// The `proxy` gate and the route handlers all run on the Node.js runtime, so
// there's no Edge bundling constraint here. `AUTH_SECRET` is a non-public env
// var — it never reaches the browser, and portal code never imports this
// client-side.

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
// A magic link may also carry the portal page to open after signing in.
export type MagicClaims = SessionClaims & { next?: string };

// A portal page to return to after signing in: the projects list or one
// project's page, by its id (no query, no other host, and none of the
// portal's routes that aren't pages, like sign-out), or nothing.
export function portalReturnPath(path: unknown): string | undefined {
  if (typeof path !== "string") return undefined;
  return /^\/portal\/(dashboard|projects\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/.test(path)
    ? path
    : undefined;
}

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
  claims: MagicClaims,
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
): Promise<MagicClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== purpose) return null;
    if (typeof payload.email !== "string") return null;
    const next = purpose === "magic" ? portalReturnPath(payload.next) : undefined;
    return next ? { email: payload.email, next } : { email: payload.email };
  } catch {
    return null;
  }
}

export const signMagicToken = (c: MagicClaims) =>
  sign(c.next ? { email: c.email, next: c.next } : { email: c.email }, "magic", MAGIC_TTL);
export const verifyMagicToken = (t: string) => verify(t, "magic");
export const signSessionToken = (c: SessionClaims) =>
  sign({ email: c.email }, "session", SESSION_TTL);
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
