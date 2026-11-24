// POST /api/portal/messages: a signed-in client writes on their project's
// thread. Only the project owner may post (collaborators can read, not write);
// the message is filed on the thread and forwarded to the owner's inbox.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import { getProjectForViewer } from "@/lib/clients";
import { recordMessage } from "@/lib/messages";
import { forwardToOwner } from "@/lib/email/relay";

const schema = z.object({
  projectId: z.string().min(1).max(100),
  body: z.string().trim().min(1).max(5000),
  hp_company: z.string().max(0).optional().or(z.literal("")),
});

export const POST = defineRoute({
  route: "portal/messages",
  auth: "portal",
  schema,
  rateLimit: { max: 10, windowMs: 10 * 60 * 1000 },
  honeypot: true,
  invalid: "Write a message first.",
  failure: { status: 500, error: "Couldn't send. Try again." },
  run: async ({ projectId, body }, { req, session }) => {
    const viewer = await getProjectForViewer(projectId, session.email);
    if (!viewer || viewer.viewerRole !== "owner") {
      return apiError(404, "That project isn't on your account.");
    }
    const { record } = viewer;

    await recordMessage({
      projectId: record.id,
      direction: "in",
      channel: "portal",
      kind: "portal",
      fromAddr: session.email,
      bodyText: body,
      status: "received",
    });

    try {
      await forwardToOwner(record, {
        from: session.email,
        subject: `New message on ${record.projectName || record.clientName || "your project"}`,
        body,
        origin: new URL(req.url).origin,
        viaPortal: true,
      });
    } catch (err) {
      // The message is on the thread either way; the owner sees it there.
      Sentry.captureException(err, {
        tags: { route: "portal/messages", stage: "forward" },
        level: "warning",
      });
    }
    return { ok: true };
  },
});
