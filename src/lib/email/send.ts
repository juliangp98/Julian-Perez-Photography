// The one way the site sends email. Every send goes through sendEmail(), which
// reads Resend's result (the SDK returns errors instead of throwing), retries
// transient failures, keeps the subject on one line, always carries a plain-
// text part, and keeps non-production builds away from real recipients. Mail
// to clients comes from Julian (resendFrom); the site's alerts to him from
// noreply@ (alertsFrom). Every send carries the site's marker header, so one
// that comes back in is never sent on, and none goes to the site's own reply
// addresses. A send on a project's thread also gets the project's reply
// address and is recorded in client_messages, failures included.

import { Resend, type CreateEmailOptions } from "resend";
import * as Sentry from "@sentry/nextjs";
import { alertsFrom, resendFrom } from "./email-helpers";
import { addressOf, inboundDomain, replyAddress, SITE_MAIL_HEADER } from "./inbound";
import { TransientError, withRetry } from "@/lib/retry";
import {
  ensureReplyToken,
  lastMessageId,
  recordMessage,
  type MessageKind,
} from "@/lib/messages";

export type EmailFailure = "not-configured" | "rejected" | "network" | "own-address";

export class EmailError extends Error {
  name = "EmailError";
  constructor(
    readonly reason: EmailFailure,
    message: string,
  ) {
    super(message);
  }
}

// A plain sentence for the owner about why an email didn't go out.
export function describeEmailFailure(err: unknown): string {
  if (!(err instanceof EmailError)) return "something unexpected went wrong";
  if (err.reason === "not-configured") return "email isn't set up on this site yet";
  if (err.reason === "rejected") return `Resend refused it (${err.message})`;
  if (err.reason === "own-address") return "it was addressed to one of the site's own reply addresses";
  return "Resend couldn't be reached, so try again in a minute";
}

export type OutgoingEmail = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  bcc?: string | string[];
  headers?: Record<string, string>;
  attachments?: CreateEmailOptions["attachments"];
  idempotencyKey?: string;
  // Who it's from: Julian, for mail to clients (the default), or the site,
  // for its alerts to him.
  sender?: "client" | "site";
  // A client-facing email that belongs on a project's thread.
  // `template` is the pipeline template a composed email started from.
  thread?: { projectId: string; kind: MessageKind; template?: string };
};

// Resend error names that mean "try again shortly" rather than "this send is
// wrong". Quota errors are 429s too but won't clear within a retry.
const TRANSIENT_NAMES = new Set(["rate_limit_exceeded", "concurrent_idempotent_requests"]);

// A real deploy (Vercel production, or a self-hosted production server) sends
// as addressed. Anything else (a preview deploy, or a local server with real
// keys) goes to the owner instead, unless it's pointed at a stand-in provider.
function safetyRecipient(): string | null {
  const productionDeploy = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";
  if (productionDeploy || process.env.RESEND_BASE_URL) return null;
  return (
    process.env.DEV_EMAIL_TO ||
    process.env.ADMIN_EMAIL?.split(",")[0]?.trim() ||
    null
  );
}

// Whether a send actually reaches the address it names: Resend is set up and
// the mail isn't redirected to the safety recipient. Something done once a day
// claims the day only then, so a preview run can't use it up.
export function deliversAsAddressed(): boolean {
  return !!process.env.RESEND_API_KEY && safetyRecipient() === null;
}

function oneLine(subject: string): string {
  return subject.replace(/\s+/g, " ").trim();
}

// Sends one email and returns Resend's id. Returns `{ id: null }` only when
// Resend isn't configured outside production, where the message is logged
// instead. Throws EmailError otherwise, so a failed send can't pass as sent.
export async function sendEmail(email: OutgoingEmail): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const subject = oneLine(email.subject);

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new EmailError("not-configured", "RESEND_API_KEY is not set");
    }
    console.log("[email] Resend not configured; would have sent:", {
      to: email.to,
      subject,
      text: email.text,
    });
    return { id: null };
  }

  const envelope = email.thread ? await threadEnvelope(email.thread.projectId) : {};
  const replyTo = envelope.replyTo ?? email.replyTo;
  const headers: Record<string, string> = { ...email.headers, ...envelope.headers, [SITE_MAIL_HEADER]: "site" };
  const redirect = safetyRecipient();
  const payload: CreateEmailOptions = {
    from: email.sender === "site" ? alertsFrom() : resendFrom(),
    to: redirect ?? email.to,
    subject: redirect ? `[preview → ${[email.to].flat().join(", ")}] ${subject}` : subject,
    text: email.text,
    ...(email.html ? { html: email.html } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(email.bcc && !redirect ? { bcc: email.bcc } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(email.attachments ? { attachments: email.attachments } : {}),
  };

  const record = (fields: { resendId?: string; status: "sent" | "failed"; statusDetail?: string }) =>
    email.thread &&
    recordMessage({
      projectId: email.thread.projectId,
      direction: "out",
      kind: email.thread.kind,
      template: email.thread.template,
      fromAddr: payload.from,
      toAddr: [email.to].flat().join(", "),
      subject,
      bodyText: email.text,
      inReplyTo: headers["In-Reply-To"],
      // Only a send that went out claims the key, so a retry after a failure
      // is still recorded.
      idempotencyKey: fields.status === "sent" ? email.idempotencyKey : undefined,
      ...fields,
    }).catch((err) =>
      Sentry.captureException(err, {
        tags: { route: "email/send", stage: "record" },
        level: "warning",
      }),
    );

  try {
    // A send to the site's own reply address would come straight back in.
    if (toOwnAddress([email.to, email.bcc ?? []].flat())) {
      throw new EmailError("own-address", "addressed to the site's own reply address");
    }
    const sent = await deliver(apiKey, payload, email.idempotencyKey);
    await record({ resendId: sent.id, status: "sent" });
    return sent;
  } catch (err) {
    if (err instanceof EmailError) await record({ status: "failed", statusDetail: err.message });
    throw err;
  }
}

function toOwnAddress(recipients: string[]): boolean {
  const domain = inboundDomain()?.toLowerCase();
  return !!domain && recipients.some((r) => addressOf(r).endsWith(`@${domain}`));
}

// The reply address and reply headers for a project's next email. Best effort:
// a store hiccup sends the email without them rather than not at all.
async function threadEnvelope(
  projectId: string,
): Promise<{ replyTo?: string; headers?: Record<string, string> }> {
  try {
    const [token, previous] = await Promise.all([
      ensureReplyToken(projectId),
      lastMessageId(projectId),
    ]);
    return {
      replyTo: token ? replyAddress(token) : undefined,
      headers: previous ? { "In-Reply-To": previous, References: previous } : undefined,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "email/send", stage: "thread" },
      level: "warning",
    });
    return {};
  }
}

async function deliver(
  apiKey: string,
  payload: CreateEmailOptions,
  idempotencyKey?: string,
): Promise<{ id: string }> {
  const resend = new Resend(apiKey);
  try {
    return await withRetry(async () => {
      const { data, error } = await resend.emails.send(
        payload,
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      if (!error) return { id: data.id };
      const transient =
        error.statusCode === null ||
        (error.statusCode ?? 0) >= 500 ||
        TRANSIENT_NAMES.has(error.name);
      if (transient) throw new TransientError(error.message);
      throw new EmailError("rejected", error.message);
    });
  } catch (err) {
    if (err instanceof EmailError) throw err;
    throw new EmailError("network", err instanceof Error ? err.message : String(err));
  }
}
