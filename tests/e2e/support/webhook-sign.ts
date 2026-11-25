import { createHmac, randomUUID } from "node:crypto";

// Signs a payload the way Resend does (Standard Webhooks: HMAC-SHA256 over
// "<id>.<timestamp>.<body>" with the base64 key after "whsec_"), so specs can
// post events to /api/email/webhook that the route accepts.

export const WEBHOOK_SECRET = `whsec_${Buffer.from("e2e-webhook-secret-not-for-production").toString("base64")}`;

export function signedWebhook(event: unknown, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(event);
  const id = `msg_${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return {
    data: body,
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    },
  };
}
