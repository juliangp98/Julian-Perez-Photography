// Upload tokens for the questionnaire's file fields. The browser asks here for
// a short-lived token, then uploads straight to Vercel Blob, so the Blob key
// never reaches it. The form is public, so a token is only issued to a browser
// on this site, for a path under questionnaires/, and for images or PDFs up to
// 10 MB. Vercel's own upload-completed callback is verified by handleUpload.

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/request-guard";
import * as Sentry from "@sentry/nextjs";

// The production site, its www alias, preview deployments (*.vercel.app) and,
// outside production, any localhost port.
const ALLOWED_ORIGINS = new Set<string>([
  "https://julianperezphotography.com",
  "https://www.julianperezphotography.com",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".vercel.app")) return true;
    return process.env.NODE_ENV !== "production" && hostname === "localhost";
  } catch {
    return false;
  }
}

// questionnaires/<service-slug>/<timestamp>-<file name>, nothing else.
const PATHNAME = /^questionnaires\/[a-z0-9-]+\/\d+-[^/\\]{1,200}$/;

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

  // A token request comes from a browser, which always sends Origin. The
  // upload-completed callback comes from Vercel without one and is
  // signature-checked inside handleUpload.
  if (body.type === "blob.generate-client-token" && !isAllowedOrigin(request.headers.get("origin"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!PATHNAME.test(pathname) || pathname.includes("..")) {
          throw new Error("That file path isn't allowed.");
        }
        return {
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
        };
      },
      // The file URLs reach Julian in the questionnaire email on submit.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "questionnaire-upload", stage: "token" },
      level: "warning",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
