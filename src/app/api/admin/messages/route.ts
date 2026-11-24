// POST /api/admin/messages: the owner sends a held reply to the client. A reply
// from the owner's address that couldn't be verified is held on the thread
// instead of being relayed; this releases it once the owner confirms it's theirs.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull } from "@/lib/clients";
import { getMessage, setMessageStatus } from "@/lib/messages";
import { relayToClient } from "@/lib/email/relay";
import { describeEmailFailure } from "@/lib/email/send";

const schema = z.object({ messageId: z.string().uuid() });

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const message = await getMessage(parsed.data.messageId);
  if (!message || message.status !== "unverified" || message.direction !== "out") {
    return NextResponse.json({ error: "There's no held reply with that id." }, { status: 404 });
  }
  const record = await getClientFull(message.projectId);
  if (!record) return NextResponse.json({ error: "That project wasn't found." }, { status: 404 });

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
  return NextResponse.json({ ok: true });
}
