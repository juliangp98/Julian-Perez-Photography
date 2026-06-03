// POST /api/portal/attach-document — links a just-uploaded Blob file to the
// signed-in client's record. The record id comes from the verified session;
// the URL must be a Vercel Blob URL (the file the client uploaded via our
// token), so a client can only ever attach a real upload to their own record.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitResponse } from "@/lib/request-guard";
import { getSession } from "@/lib/auth-cookies";
import { appendDocument, getProjectForEmail } from "@/lib/clients";
import * as Sentry from "@sentry/nextjs";

// Document kinds the client can label an upload with — surfaced as a badge in
// the portal. "other" is the default when none is chosen.
const DOC_KINDS = [
  "other",
  "contract",
  "invoice",
  "timeline",
  "moodboard",
] as const;

const schema = z.object({
  projectId: z.string().min(1),
  url: z.string().url(),
  label: z.string().min(1).max(200),
  type: z.enum(DOC_KINDS).optional(),
});

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, {
    key: "portal-attach",
    max: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  }

  // Only accept Blob URLs — the file the client just uploaded through our
  // token endpoint. Blocks arbitrary external links being injected as docs.
  try {
    const host = new URL(parsed.data.url).hostname;
    if (!host.endsWith(".blob.vercel-storage.com")) {
      return NextResponse.json(
        { error: "Unsupported file URL." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  // Ownership gate — the project must belong to the signed-in person.
  const owned = await getProjectForEmail(parsed.data.projectId, session.email);
  if (!owned) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    await appendDocument(parsed.data.projectId, {
      label: parsed.data.label,
      type: parsed.data.type ?? "other",
      url: parsed.data.url,
      uploadedBy: "client",
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[portal] attach-document error:", err);
    Sentry.captureException(err, { tags: { route: "portal-attach-document" } });
    return NextResponse.json(
      { error: "Couldn't save the document." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
