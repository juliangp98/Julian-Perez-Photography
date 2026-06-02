// POST /api/portal/upload — issues a short-lived Vercel Blob upload token for
// an authenticated client. Mirrors /api/questionnaire-upload but gated on the
// session: the token is only minted for signed-in clients, and the record id
// is round-tripped in the token payload.
//
// The uploaded file is linked to the record by a follow-up call to
// /api/portal/attach-document (which works in dev and prod alike, unlike Blob's
// server-to-server onUploadCompleted callback that can't reach localhost).

export const runtime = "nodejs";

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/request-guard";
import { getSession } from "@/lib/auth-cookies";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, {
    key: "portal-upload",
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
      onBeforeGenerateToken: async () => {
        // Only mint a token for a signed-in client. The uploaded file is linked
        // to a specific project (with an ownership check) by the follow-up call
        // to /api/portal/attach-document, so no record id is needed here.
        const session = await getSession();
        if (!session) throw new Error("Not authenticated");
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
            "application/pdf",
          ],
          maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ email: session.email }),
        };
      },
      onUploadCompleted: async () => {
        // Linking happens via /api/portal/attach-document so it works in dev
        // too (Blob can't call back to localhost). Intentionally empty.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "portal-upload" } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
