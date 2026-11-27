// POST /api/portal/attach-document: links a just-uploaded Blob file to one of
// the signed-in client's own projects. Only Vercel Blob URLs are accepted, so a
// client can only attach a real upload, and only to a project they own. Julian
// is emailed about the file (fire-and-forget).

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute, originOf } from "@/lib/api-route";
import { addDocument, getProjectForEmail } from "@/lib/clients";
import { CLIENT_DOCUMENT_TYPES, documentTypeLabel } from "@/lib/labels";
import { notifyOwnerOfPortal } from "@/lib/email/notify";
import { projectDisplayName } from "@/lib/project-name";

// The kinds a client can label an upload with (a timeline, a moodboard, or a
// general file). Proposals, contracts, invoices and galleries are Julian's to
// add, so a client can't file something under those names. "other" is the
// default when none is chosen.
const CLIENT_KINDS = CLIENT_DOCUMENT_TYPES.map((t) => t.value) as [string, ...string[]];

export const POST = defineRoute({
  route: "portal/attach-document",
  auth: "portal",
  schema: z.object({
    projectId: z.string().min(1),
    url: z.string().url(),
    label: z.string().min(1).max(200),
    type: z.enum(CLIENT_KINDS).optional(),
  }),
  rateLimit: { max: 20, windowMs: 10 * 60 * 1000 },
  invalid: "Invalid document.",
  failure: { status: 500, error: "Couldn't save the document." },
  run: async ({ projectId, url, label, type }, { req, session }) => {
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

    await addDocument(projectId, {
      label,
      type: type ?? "other",
      url,
      uploadedBy: "client",
    });
    try {
      await notifyOwnerOfPortal({
        subject: `New file on ${projectDisplayName(owned)}: ${label}`,
        heading: "A client uploaded a file",
        lines: [
          `${session.email} added "${label}" (${documentTypeLabel(type ?? "other")}) to ${projectDisplayName(owned)} in the client portal.`,
        ],
        cta: { label: "Open its links and files →", href: `${originOf(req)}/admin/projects/${projectId}?tab=links` },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "portal/attach-document", stage: "notify" },
        level: "warning",
      });
    }
    return { ok: true };
  },
});
