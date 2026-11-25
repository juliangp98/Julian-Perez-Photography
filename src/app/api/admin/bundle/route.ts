// POST /api/admin/bundle: owner-only. Links or unlinks projects into a bundle;
// the link helper requires every project to share one email, so a bundle never
// spans two clients.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { setBundleAdmin, clearBundleAdmin } from "@/lib/clients";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    projectIds: z.array(z.string().min(1)).min(2).max(20),
    label: z.string().min(1).max(100),
  }),
  z.object({ action: z.literal("unlink"), projectId: z.string().min(1) }),
]);

export const POST = defineRoute({
  route: "admin/bundle",
  auth: "admin",
  schema,
  failure: { status: 500, error: "Couldn't update. Try again." },
  run: async (data) => {
    if (data.action === "link") {
      await setBundleAdmin(data.projectIds, data.label);
    } else {
      await clearBundleAdmin(data.projectId);
    }
    return { ok: true };
  },
});
