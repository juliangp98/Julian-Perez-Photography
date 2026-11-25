// POST /api/admin/quick-log: owner-only. Adds a status-history note and/or a
// status change from the projects overview. Nothing here emails the client.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { addAdminLog } from "@/lib/clients";
import { CLIENT_STATUS_OPTIONS } from "@/lib/client-status";

const STATUS_VALUES = CLIENT_STATUS_OPTIONS.map((s) => s.value) as [
  string,
  ...string[],
];

const schema = z
  .object({
    projectId: z.string().min(1),
    status: z.enum(STATUS_VALUES).optional(),
    note: z.string().max(500).optional(),
  })
  .refine((d) => !!d.status || !!d.note?.trim(), {
    message: "Provide a status change or a note.",
  });

export const POST = defineRoute({
  route: "admin/quick-log",
  auth: "admin",
  schema,
  failure: { status: 500, error: "Couldn't save. Try again." },
  run: async (data) => {
    await addAdminLog(data.projectId, { status: data.status, note: data.note });
    return { ok: true };
  },
});
