// POST /api/admin/create-project: owner-only. Creates a project stub from
// whatever details are known. Without `force` it answers with an existing
// email+service duplicate instead of creating a second one.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { createProjectManual, findDuplicateProject } from "@/lib/clients";

const schema = z.object({
  email: z.string().email(),
  clientName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  serviceType: z.string().max(100).optional(),
  eventDate: z.string().max(100).optional(),
  package: z.string().max(200).optional(),
  force: z.boolean().optional(),
});

export const POST = defineRoute({
  route: "admin/create-project",
  auth: "admin",
  schema,
  rateLimit: { max: 30, windowMs: 60_000 },
  failure: { status: 500, error: "Couldn't create. Try again." },
  run: async ({ force, ...input }) => {
    if (!force) {
      const dup = await findDuplicateProject(input.email, input.serviceType);
      if (dup) return { ok: true, duplicate: dup };
    }
    const id = await createProjectManual({ ...input, source: "manual-admin" });
    return { ok: true, id };
  },
});
