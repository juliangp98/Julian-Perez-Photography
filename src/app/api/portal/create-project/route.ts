// POST /api/portal/create-project: a signed-in client starts a new project for
// their own email (from the session, never the body). Without `force` it
// answers with an existing email+service duplicate instead of creating one.
// Julian is emailed about the new project (fire-and-forget).

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { defineRoute, originOf } from "@/lib/api-route";
import { createProjectManual, findDuplicateProject } from "@/lib/clients";
import { notifyOwnerOfPortal } from "@/lib/email/notify";
import { serviceTitle } from "@/lib/services-data";

export const POST = defineRoute({
  route: "portal/create-project",
  auth: "portal",
  schema: z.object({
    serviceType: z.string().max(100).optional(),
    eventDate: z.string().max(100).optional(),
    force: z.boolean().optional(),
  }),
  rateLimit: { max: 15, windowMs: 10 * 60 * 1000 },
  failure: { status: 500, error: "Couldn't create. Try again." },
  run: async ({ force, serviceType, eventDate }, { req, session }) => {
    if (!force) {
      const dup = await findDuplicateProject(session.email, serviceType);
      if (dup) return { ok: true, duplicate: dup };
    }
    const id = await createProjectManual({
      email: session.email,
      serviceType,
      eventDate,
      source: "manual-client",
    });
    try {
      const service = serviceTitle(serviceType);
      await notifyOwnerOfPortal({
        subject: `New project in the portal: ${session.email}`,
        heading: "A client started a project",
        lines: [
          `${session.email} started a project in the client portal${service ? ` for ${service}` : ", with no service picked yet"}.`,
        ],
        cta: { label: "Open the project →", href: `${originOf(req)}/admin/projects/${id}` },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "portal/create-project", stage: "notify" },
        level: "warning",
      });
    }
    return { ok: true, id };
  },
});
