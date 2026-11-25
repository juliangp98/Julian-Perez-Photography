// POST /api/email/webhook: Resend's events for this site. Delivery events
// (delivered, bounced, ...) update the matching thread message; received mail
// is filed on its project's thread (see src/lib/email/relay.ts).
//
// Signed by Resend (svix headers) with RESEND_WEBHOOK_SECRET. Without the
// secret the route refuses everything; an unsigned or tampered request is a
// 401. A processing failure answers 500 so Resend retries, and every write is
// idempotent on Resend's ids, so a retry never doubles a message.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend, type WebhookEventPayload } from "resend";
import * as Sentry from "@sentry/nextjs";
import { handleWebhookEvent } from "@/lib/email/relay";
import { originOf } from "@/lib/api-route";

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    Sentry.captureMessage("RESEND_WEBHOOK_SECRET is not set", {
      tags: { route: "email/webhook", stage: "config" },
    });
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const payload = await req.text();
  let event: WebhookEventPayload;
  try {
    // verify() needs no network call; the key only satisfies the constructor.
    event = new Resend(process.env.RESEND_API_KEY || "re_unused").webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    await handleWebhookEvent(event, originOf(req));
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "email/webhook", stage: event.type } });
    return NextResponse.json({ error: "Couldn't process the event." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
