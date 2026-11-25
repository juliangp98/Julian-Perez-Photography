// POST /api/admin/messages: owner-only. Sends a held reply to the client. A
// reply from the owner's address that couldn't be verified is held on the
// thread; this releases it once the owner confirms it's theirs.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { getMessage, setMessageStatus } from "@/lib/messages";
import { relayToClient } from "@/lib/email/relay";
import { describeEmailFailure } from "@/lib/email/send";

export const POST = defineRoute({
  route: "admin/messages",
  auth: "admin",
  schema: z.object({ messageId: z.string().uuid() }),
  run: async ({ messageId }) => {
    const message = await getMessage(messageId);
    if (!message || message.status !== "unverified" || message.direction !== "out") {
      return apiError(404, "There's no held reply with that id.");
    }
    const record = await getClientFull(message.projectId);
    if (!record) return apiError(404, "That project wasn't found.");

    try {
      await relayToClient(
        record,
        message.subject || `About ${record.projectName || "your project"}`,
        message.bodyText ?? "",
        `release-${message.id}`,
      );
      await setMessageStatus(message.id, "dropped", "Sent after review.");
    } catch (err) {
      Sentry.captureException(err, { tags: { route: "admin/messages", stage: "release" } });
      return NextResponse.json({ error: `Not sent: ${describeEmailFailure(err)}.` }, { status: 502 });
    }
    return { ok: true };
  },
});
