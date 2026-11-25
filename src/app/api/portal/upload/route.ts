// POST /api/portal/upload: a short-lived Vercel Blob upload token for a
// signed-in client, or for the owner adding a file from the admin. The file is
// linked to a project afterwards: a client's by /api/portal/attach-document,
// which checks ownership, and the owner's by /api/admin/update.

export const runtime = "nodejs";

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/request-guard";
import { getAdminSession, getSession } from "@/lib/auth-cookies";
import * as Sentry from "@sentry/nextjs";
import { UPLOAD_CONTENT_TYPES } from "@/lib/labels";

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
  const session = (await getSession()) ?? (await getAdminSession());
  if (body.type === "blob.generate-client-token" && !session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!session) throw new Error("Not signed in");
        return {
          allowedContentTypes: UPLOAD_CONTENT_TYPES,
          maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ email: session.email }),
        };
      },
      // Linking happens in attach-document, which also works locally.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "portal/upload", stage: "token" }, level: "warning" });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
