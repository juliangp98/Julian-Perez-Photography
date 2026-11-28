// POST /api/portal/update: client-portal field edits. The caller must own the
// project; the zod schema is the whitelist, so status, package, pricing, and
// internal fields are never editable here.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute, originOf } from "@/lib/api-route";
import { updateClientFields, getProjectForEmail } from "@/lib/clients";
import { notifyOwnerOfPortal } from "@/lib/email/notify";
import { projectDisplayName } from "@/lib/project-name";

const schema = z.object({
  projectId: z.string().min(1),
  phone: z.string().max(50).optional(),
  partnerName: z.string().max(200).optional(),
  guestCount: z.coerce.number().int().min(0).max(100000).optional(),
  projectName: z.string().max(200).optional(),
});

// The fields a client can change here, as the owner's notice names them.
const FIELD_LABELS = {
  phone: "Phone",
  partnerName: "Partner's name",
  guestCount: "Guest count",
  projectName: "Project name",
} as const;

export const POST = defineRoute({
  route: "portal/update",
  auth: "portal",
  schema,
  rateLimit: { max: 20, windowMs: 10 * 60 * 1000 },
  invalid: "Please check the form and try again.",
  failure: { status: 500, error: "Couldn't save right now. Try again." },
  run: async ({ projectId, ...fields }, { req, session }) => {
    // Ownership gate: the project must belong to the signed-in person.
    const owned = await getProjectForEmail(projectId, session.email);
    if (!owned) return apiError(404, "Not found.");

    await updateClientFields(projectId, fields);

    // What changed, one line each ("Phone: (703) 555-0100 → (703) 555-0199").
    // Saving without a change emails no one.
    const shown = (v: unknown) => (v == null || String(v).trim() === "" ? "none" : String(v).trim());
    const changes = (Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[])
      .filter((k) => fields[k] !== undefined && shown(fields[k]) !== shown(owned[k]))
      .map((k) => `${FIELD_LABELS[k]}: ${shown(owned[k])} → ${shown(fields[k])}`);
    if (!changes.length) return { ok: true };

    // Tell the owner (fire-and-forget) so the change gets reviewed.
    try {
      await notifyOwnerOfPortal({
        subject: `Client updated their details: ${owned.clientName || session.email}`,
        heading: "Client details updated",
        lines: [
          `${owned.clientName || session.email} updated their details on ${projectDisplayName(owned)} in the client portal:`,
          ...changes,
        ],
        cta: { label: "Open its details →", href: `${originOf(req)}/admin/projects/${projectId}?tab=details` },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "portal/update", stage: "notify" },
        level: "warning",
      });
    }

    return { ok: true };
  },
});
