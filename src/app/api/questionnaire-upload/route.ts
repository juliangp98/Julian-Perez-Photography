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
