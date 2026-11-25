// POST /api/portal/attach-document: links a just-uploaded Blob file to one of
// the signed-in client's own projects. Only Vercel Blob URLs are accepted, so a
// client can only attach a real upload, and only to a project they own.

export const runtime = "nodejs";

import { z } from "zod";
import { apiError, defineRoute } from "@/lib/api-route";
import { appendDocument, getProjectForEmail } from "@/lib/clients";

// Document kinds the client can label an upload with, surfaced as a badge in
// the portal. "other" is the default when none is chosen.
const DOC_KINDS = [
  "other",
  "contract",
  "invoice",
  "timeline",
  "moodboard",
] as const;

export const POST = defineRoute({
  route: "portal/attach-document",
  auth: "portal",
  schema: z.object({
    projectId: z.string().min(1),
    url: z.string().url(),
    label: z.string().min(1).max(200),
    type: z.enum(DOC_KINDS).optional(),
  }),
  rateLimit: { max: 20, windowMs: 10 * 60 * 1000 },
  invalid: "Invalid document.",
  failure: { status: 500, error: "Couldn't save the document." },
  run: async ({ projectId, url, label, type }, { session }) => {
    // Only the file the client just uploaded through the token endpoint;
    // blocks arbitrary external links being injected as documents.
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return apiError(400, "Invalid URL.");
    }
    if (!host.endsWith(".blob.vercel-storage.com")) {
      return apiError(400, "Unsupported file URL.");
    }

    const owned = await getProjectForEmail(projectId, session.email);
    if (!owned) return apiError(404, "Not found.");

    await appendDocument(projectId, {
      label,
      type: type ?? "other",
      url,
      uploadedBy: "client",
      uploadedAt: new Date().toISOString(),
    });
    return { ok: true };
  },
});
