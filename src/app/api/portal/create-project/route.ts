// POST /api/portal/create-project: a signed-in client starts a new project for
// their own email (from the session, never the body). Without `force` it
// answers with an existing email+service duplicate instead of creating one.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { createProjectManual, findDuplicateProject } from "@/lib/clients";

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
  run: async ({ force, serviceType, eventDate }, { session }) => {
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
    return { ok: true, id };
  },
});
