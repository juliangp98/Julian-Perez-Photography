// POST /api/admin/update: owner-only full-record edit. The record id comes from
// the body (the owner may edit any record). An optional client email lists what
// changed and never includes the internal note, budget, or raw service slug.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { defineRoute, originOf } from "@/lib/api-route";
import { updateClientAdmin, getClientFull } from "@/lib/clients";
import { projectDisplayName } from "@/lib/project-name";
import { sendClientUpdateEmail, summarizeClientChanges } from "@/lib/email/notify";
import { describeEmailFailure } from "@/lib/email/send";

const schema = z.object({
  id: z.string().min(1),
  notifyClient: z.boolean().optional(),
  fields: z.object({
    clientName: z.string().max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    partnerName: z.string().max(200).optional(),
    status: z.string().max(50).optional(),
    serviceType: z.string().max(100).optional(),
    package: z.string().max(200).optional(),
    eventDate: z.string().max(100).optional(),
    guestCount: z.coerce.number().int().min(0).max(1000000).optional(),
    budget: z.string().max(100).optional(),
    planSummary: z.string().max(10000).optional(),
    internalNotes: z.string().max(10000).optional(),
    galleryUrl: z.string().max(2000).optional(),
    projectName: z.string().max(200).optional(),
    // Venue / address rows (admin-editable; persisted to the locations JSONB).
    locations: z
      .array(
        z.object({
          label: z.string().max(300).optional(),
          address: z.string().max(500).optional(),
          notes: z.string().max(1000).optional(),
        }),
      )
      .max(20)
      .optional(),
  }),
});

export const POST = defineRoute({
  route: "admin/update",
  auth: "admin",
  schema,
  invalid: "Invalid input.",
  failure: { status: 500, error: "Couldn't save. Try again." },
  run: async ({ id, notifyClient, fields: f }, { req }) => {
    // Snapshot the record before the write so the client email can describe what
    // actually changed (only fetched when a notification is requested).
    const before = notifyClient ? await getClientFull(id) : null;

    await updateClientAdmin(id, f);

    let notifyError: string | undefined;
    if (notifyClient && before?.email) {
      try {
        // Name from the post-update view (a renamed/redated project reads right).
        const name = projectDisplayName({
          projectName: f.projectName ?? before.projectName,
          clientName: f.clientName ?? before.clientName,
          serviceType: f.serviceType ?? before.serviceType,
          eventDate: f.eventDate ?? before.eventDate,
        });
        const changes = summarizeClientChanges(before, f);
        await sendClientUpdateEmail({
          projectId: id,
          to: before.email,
          firstName: (f.clientName ?? before.clientName)?.split(" ")[0],
          projectName: name,
          portalUrl: `${originOf(req)}/portal`,
          lines: changes.length
            ? [`Here's the latest on ${name}:`]
            : [
                `There's a new update on ${name}.`,
                "Sign in to your portal to see the latest.",
              ],
          changes,
        });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "admin/update", stage: "notify" },
          level: "warning",
        });
        notifyError = describeEmailFailure(err);
      }
    }

    return { ok: true, notifyError };
  },
});
