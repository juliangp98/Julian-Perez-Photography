// The one way the site sends email. Every send goes through sendEmail(), which
// reads Resend's result (the SDK returns errors instead of throwing), retries
// transient failures, keeps the subject on one line, always carries a plain-
// text part, and keeps non-production builds away from real recipients.

import { Resend, type CreateEmailOptions } from "resend";
import { resendFrom } from "./email-helpers";
import { TransientError, withRetry } from "@/lib/retry";

export type EmailFailure = "not-configured" | "rejected" | "network";

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

  const redirect = safetyRecipient();
  const payload: CreateEmailOptions = {
    from: resendFrom(),
    to: redirect ?? email.to,
    subject: redirect ? `[preview → ${[email.to].flat().join(", ")}] ${subject}` : subject,
    text: email.text,
    ...(email.html ? { html: email.html } : {}),
    ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    ...(email.bcc && !redirect ? { bcc: email.bcc } : {}),
    ...(email.headers ? { headers: email.headers } : {}),
    ...(email.attachments ? { attachments: email.attachments } : {}),
  };

  const resend = new Resend(apiKey);
  try {
    return await withRetry(async () => {
      const { data, error } = await resend.emails.send(
        payload,
        email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
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
