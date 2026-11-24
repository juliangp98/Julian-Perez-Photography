// POST /api/admin/delete-project: owner-only. Permanently deletes one project
// row; the store no-ops when it isn't configured.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { deleteClient } from "@/lib/clients";

export const POST = defineRoute({
  route: "admin/delete-project",
  auth: "admin",
  schema: z.object({ projectId: z.string().min(1).max(100) }),
  rateLimit: { max: 20, windowMs: 60_000 },
  failure: { status: 500, error: "Couldn't delete. Try again." },
  run: async ({ projectId }) => {
    await deleteClient(projectId);
    return { ok: true };
  },
});
