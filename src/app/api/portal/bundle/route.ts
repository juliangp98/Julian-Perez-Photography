// POST /api/portal/bundle: a signed-in client links or unlinks their own
// projects into a bundle. The helpers drop any id not owned by the session's
// email, so a client can never bundle someone else's projects.

export const runtime = "nodejs";

import { z } from "zod";
import { defineRoute } from "@/lib/api-route";
import { setBundleForEmail, clearBundleForEmail } from "@/lib/clients";

export const POST = defineRoute({
  route: "portal/bundle",
  auth: "portal",
  schema: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("link"),
      projectIds: z.array(z.string().min(1)).min(2).max(20),
      label: z.string().min(1).max(100),
    }),
    z.object({ action: z.literal("unlink"), projectId: z.string().min(1) }),
  ]),
  rateLimit: { max: 30, windowMs: 10 * 60 * 1000 },
  failure: { status: 500, error: "Couldn't update. Try again." },
  run: async (data, { session }) => {
    if (data.action === "link") {
      await setBundleForEmail(session.email, data.projectIds, data.label);
    } else {
      await clearBundleForEmail(session.email, data.projectId);
    }
    return { ok: true };
  },
});
