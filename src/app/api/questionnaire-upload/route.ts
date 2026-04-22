// Signed-URL handler for questionnaire file uploads.
//
// The QuestionnaireForm's `file` field type uploads directly to Vercel Blob
// from the browser using `@vercel/blob/client`'s `upload()`. That client
// function calls this route first to get a short-lived signed token, then
// uploads the file directly to Blob storage. `BLOB_READ_WRITE_TOKEN` never
// reaches the browser.
//
// Configuration: enable Vercel Blob in the project dashboard and the env var
// is auto-provisioned in deployed environments. Locally, pull via
// `vercel env pull` or set `BLOB_READ_WRITE_TOKEN` manually in `.env.local`.
//
// No authentication — the questionnaire form is public, and caps
// (10 MB / file, image or PDF MIME types only) are enforced in
// `onBeforeGenerateToken`.

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/request-guard";

// Origins that may legitimately request an upload token. The production
// site, its www alias, local dev, and Vercel preview deployments. Anything
// else is either a scripted probe from another origin or a misconfigured
// client — returning 403 keeps a stray token from leaving the server while
// the rate limit and MIME/size caps continue to protect the real flow.
const ALLOWED_ORIGINS = new Set<string>([
  "https://julianperezphotography.com",
  "https://www.julianperezphotography.com",
  "http://localhost:3000",
]);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    // Preview deployments rotate on every push; a static allowlist
    // would reject them. Scope the wildcard to vercel.app so an
    // attacker can't spoof it with an arbitrary subdomain of their own.
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

export async function POST(request: Request) {
  // Rate limit: 20 token requests / 10 min / IP. Each token = one file,
  // and the questionnaire's file field caps at 6 files so a real client
  // shouldn't come anywhere near this.
  const limited = rateLimitResponse(request, {
    key: "questionnaire-upload",
    max: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  // Cross-origin guard. Browsers set `Origin` on every non-GET fetch,
  // so a missing header generally means a non-browser caller (curl,
  // server-to-server). Those are let through — the blob SDK itself
  // calls this route from trusted Vercel infrastructure on upload
  // completion, and rejecting them would break the upload handshake.
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
          "image/heif",
          "image/gif",
          "application/pdf",
        ],
        maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ pathname }),
      }),
      onUploadCompleted: async () => {
        // No DB side-effects — URLs are surfaced to Julian via the
        // questionnaire email body when the form is submitted. Intentionally
        // empty.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
