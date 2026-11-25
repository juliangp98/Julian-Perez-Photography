// POST /api/admin/quick-log: owner-only. Adds a status-history note and/or a
// status change from the projects overview. An opt-in client email names only
// the status change, never the internal note.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { defineRoute, originOf } from "@/lib/api-route";
import { addAdminLog, getClientFull } from "@/lib/clients";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";
import { projectDisplayName } from "@/lib/project-name";
import { sendClientUpdateEmail, summarizeClientChanges } from "@/lib/email/notify";
import { describeEmailFailure } from "@/lib/email/send";

const STATUS_VALUES = CLIENT_STATUS_OPTIONS.map((s) => s.value) as [
  string,
  ...string[],
];

const schema = z
  .object({
    projectId: z.string().min(1),
    status: z.enum(STATUS_VALUES).optional(),
    note: z.string().max(500).optional(),
    notifyClient: z.boolean().optional(),
  })
  .refine((d) => !!d.status || !!d.note?.trim(), {
    message: "Provide a status change or a note.",
  });

export const POST = defineRoute({
  route: "admin/quick-log",
  auth: "admin",
  schema,
  failure: { status: 500, error: "Couldn't save. Try again." },
  run: async (data, { req }) => {
    // Snapshot before the write so the client email can name the status change.
    const before = data.notifyClient ? await getClientFull(data.projectId) : null;

    await addAdminLog(data.projectId, { status: data.status, note: data.note });

    let notifyError: string | undefined;
    if (data.notifyClient && before?.email) {
      try {
        const name = projectDisplayName(before);
        const changes = summarizeClientChanges(before, { status: data.status });
        await sendClientUpdateEmail({
          projectId: data.projectId,
          to: before.email,
          firstName: before.clientName?.split(" ")[0],
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
          tags: { route: "admin/quick-log", stage: "notify" },
          level: "warning",
        });
        notifyError = describeEmailFailure(err);
      }
    }

    return { ok: true, notifyError };
  },
});
