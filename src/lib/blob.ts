// Server-only helper for storing generated PDFs in Vercel Blob.
//
// Used to persist the Wedding Day Plan / Wedding Films Plan PDF when a
// questionnaire is captured into a client record, so the plan is linkable from
// the client's record and portal (in addition to the email attachment).
//
// Blobs are `access: "public"` with a random suffix — the URL is unguessable
// but not access-controlled, the same model the questionnaire file-upload route
// already uses. The PDF is also emailed, so this is consistent with the
// project's existing posture. No-ops (returns null) when the Blob token isn't
// configured, so capture degrades gracefully.

import "server-only";
import { put } from "@vercel/blob";

export async function storePdf(opts: {
  key: string;
  data: Buffer;
}): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const result = await put(opts.key, opts.data, {
    access: "public",
    token,
    contentType: "application/pdf",
    addRandomSuffix: true,
  });
  return result.url;
}
