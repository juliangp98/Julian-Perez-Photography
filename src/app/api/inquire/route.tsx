// POST /api/inquire: public inquiry form. Files the client record, assesses the
// inquiry with AI, and emails the owner (the only step that can fail the
// submission); the owner text alert and the client's email and text
// confirmations are best-effort side effects.

export const runtime = "nodejs";

import { z } from "zod";
import { render } from "@react-email/components";
import { getSiteSettings, getService } from "@/lib/content";
import {
  BrandedEmailLayout,
  InquiryEmailTemplate,
  ClientConfirmationTemplate,
} from "@/lib/email/email-templates";
import { apiError, defineRoute, originOf } from "@/lib/api-route";
import { formatSubjectDate } from "@/lib/email/email-helpers";
import { sendEmail } from "@/lib/email/send";
import { REFERRAL_LABELS, formatReferral } from "@/lib/referral";
import * as Sentry from "@sentry/nextjs";
import { sendSms } from "@/lib/sms";
import { saveAiResult, upsertClientFromInquiry } from "@/lib/clients";
import { aiBasis } from "@/lib/ai/project-context";
import { assessInquiry, shouldAlertOwner } from "@/lib/ai/assess-inquiry";
import { draftReplyHref, triageVerdict, type InquiryTriage } from "@/lib/triage";

// How long a submission waits for the AI assessment. Past it the owner email
// goes out without one (the project page's "Assess this inquiry" still works).
const TRIAGE_WAIT_MS = 8_000;

const schema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional().or(z.literal("")),
  service: z.string().min(1),
  eventDate: z.string().optional().or(z.literal("")),
  location: z.string().max(300).optional().or(z.literal("")),
  budget: z.string().max(100).optional().or(z.literal("")),
  referral: z.string().max(100).optional().or(z.literal("")),
  referralOther: z.string().max(200).optional().or(z.literal("")),
  message: z.string().min(1).max(5000),
  // Optional id of a manually-created project this inquiry should attach to
  // (from a completion link). Validated against the email server-side.
  project: z.string().max(100).optional().or(z.literal("")),
  // Honeypot — should be empty (named hp_company to avoid collision with
  // legitimate "company" fields in questionnaires like corporate-headshots)
  hp_company: z.string().max(0).optional().or(z.literal("")),
});

export const POST = defineRoute({
  route: "inquire",
  auth: "public",
  schema,
  // 5 submissions / 10 min / IP: a legitimate client will never hit this; a
  // bot farm will.
  rateLimit: { max: 5, windowMs: 10 * 60 * 1000 },
  honeypot: true,
  invalid: "Please check the form and try again.",
  run: async (data, { req }) => {
    // The channel's short label tags the subject line for inbox filtering; the
    // full source ("Venue: Foxchase Manor") goes in the body and the record.
    const referralLabel = data.referral
      ? REFERRAL_LABELS[data.referral] ?? data.referral
      : "";
    const referral = formatReferral(data.referral, data.referralOther);

    // Start the assessment now so its latency overlaps the content fetches and
    // the record write. It settles to null on any failure or after
    // TRIAGE_WAIT_MS: it adds to the owner email but never fails or stalls a
    // submission. Without an AI key it resolves to null straight away.
    const triagePromise = settleWithin(
      assessInquiry({
        serviceType: data.service,
        clientName: data.name,
        eventDate: data.eventDate || undefined,
        budget: data.budget || undefined,
        venue: data.location || undefined,
        referral: referral || undefined,
        message: data.message,
      }).catch((err: unknown) => {
        Sentry.captureException(err, {
          tags: { route: "inquire", stage: "triage" },
          level: "warning",
        });
        return null;
      }),
      TRIAGE_WAIT_MS,
    );

    // getService + getSiteSettings are both async + React-cached. Fetch
    // them in parallel so the inquiry doesn't serialize two Sanity
    // round-trips on every submit.
    const [svc, settings] = await Promise.all([
      getService(data.service),
      getSiteSettings(),
    ]);
    const serviceName = svc?.title || data.service;

    const toAddress = process.env.INQUIRY_TO || settings.contactEmail;

    // Durable capture: upsert a client record so the inquiry isn't lost to the
    // inbox, even if the owner email then fails. It comes first so the owner
    // email can link to the project and the confirmation can start its thread.
    // A store failure (or an unconfigured store) never fails the submission.
    let projectId: string | null = null;
    let messageStored = false;
    try {
      const filed = await upsertClientFromInquiry({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        service: data.service,
        eventDate: data.eventDate || undefined,
        location: data.location || undefined,
        budget: data.budget || undefined,
        referral: referral || undefined,
        message: data.message,
        projectId: data.project || undefined,
      });
      projectId = filed?.id ?? null;
      messageStored = !!filed?.messageStored;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "inquire", stage: "client-record" },
        level: "warning",
      });
    }

    const triage = await triagePromise;
    // Saved on the project, so its page shows the assessment without asking
    // again and the draft link needs nothing but the project. Only when the
    // project holds this message: a repeat inquiry keeps the first message, and
    // its assessment with it (this one still reaches the owner email below).
    if (projectId && triage && messageStored) {
      try {
        await saveAiResult(projectId, "triage", {
          result: triage,
          at: new Date().toISOString(),
          basis: aiBasis(data.message),
        });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "inquire", stage: "save-triage" },
          level: "warning",
        });
      }
    }
    const projectUrl = projectId ? `${originOf(req)}/admin/projects/${projectId}` : undefined;
    const draftReplyUrl = projectUrl ? draftReplyHref(projectUrl) : undefined;
    // The discovery-call guide for this project, for when a call is booked.
    const callPrepUrl = projectUrl ? `${projectUrl}?tab=call` : undefined;

    // Include the event date in the subject when supplied — makes triage
    // easier when multiple inquiries for the same service land in a row.
    const subject = `New inquiry: ${serviceName}, ${data.name}${formatSubjectDate(data.eventDate)}${referralLabel ? ` [via: ${referralLabel}]` : ""}`;
    const empty = "—";
    const text = [
      `New inquiry from ${settings.siteName}`,
      ``,
      `Name:      ${data.name}`,
      `Email:     ${data.email}`,
      `Phone:     ${data.phone || empty}`,
      `Service:   ${serviceName}`,
      `Date:      ${data.eventDate || empty}`,
      `Location:  ${data.location || empty}`,
      `Budget:    ${data.budget || empty}`,
      `Referral:  ${referral || empty}`,
      ``,
      `Message:`,
      data.message,
      ...(triage
        ? [
            ``,
            `AI assessment: ${triageVerdict(triage)}`,
            triage.summary,
            [triage.fitReason, triage.urgencyReason].filter(Boolean).join(" "),
          ]
        : []),
      ...(draftReplyUrl ? [``, `Draft a reply: ${draftReplyUrl}`] : []),
      ...(callPrepUrl ? [`Prep for the call: ${callPrepUrl}`] : []),
    ].join("\n");

    // The branded template shows the friendly source ("Venue: Foxchase Manor")
    // rather than the internal slug. Its preheader, which an inbox or lock
    // screen shows under the subject, leads with the verdict when there is one.
    const emailData = { ...data, referral: referral || undefined };
    const preview = triage
      ? `${triageVerdict(triage)}. ${triage.summary}`
      : `New inquiry from ${data.name}: ${serviceName}`;
    const html = await render(
      <BrandedEmailLayout preview={preview}>
        <InquiryEmailTemplate
          data={emailData}
          serviceName={serviceName}
          triage={triage}
          draftReplyUrl={draftReplyUrl}
          callPrepUrl={callPrepUrl}
        />
      </BrandedEmailLayout>,
    );

    try {
      await sendEmail({ to: toAddress, replyTo: data.email, subject, html, text });
    } catch (err: unknown) {
      Sentry.captureException(err, {
        tags: { route: "inquire", stage: "owner-email" },
      });
      const msg =
        err instanceof Error ? err.message?.toLowerCase() ?? "" : "";
      const userMessage = msg.includes("valid")
        ? "The email address doesn't appear to be valid. Please double-check and try again."
        : msg.includes("rate")
          ? "Too many submissions. Wait a moment and try again."
          : `Could not send right now. Email ${settings.contactEmail} directly.`;
      return apiError(500, userMessage);
    }

    // Owner text alert, fire and forget. Opt-in via INQUIRY_SMS_TO, and only
    // for the leads worth an interruption (see shouldAlertOwner).
    const ownerPhone = process.env.INQUIRY_SMS_TO;
    if (ownerPhone && shouldAlertOwner(triage)) {
      try {
        await sendSms(
          ownerPhone,
          ownerAlertText({ name: data.name, serviceName, eventDate: data.eventDate, referralLabel, triage, message: data.message }),
        );
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "inquire", stage: "owner-sms" },
          level: "warning",
        });
      }
    }

    // Client confirmation email — fire and forget; don't fail the submission.
    try {
      const confirmHtml = await render(
        <BrandedEmailLayout preview="Thanks for reaching out. I'll be in touch soon.">
          <ClientConfirmationTemplate clientName={data.name} />
        </BrandedEmailLayout>,
      );
      await sendEmail({
        replyTo: settings.contactEmail,
        to: data.email,
        ...(projectId ? { thread: { projectId, kind: "confirmation" as const } } : {}),
        subject: "Thanks for your inquiry | Julian Perez Photography",
        html: confirmHtml,
        text: `Thank you, ${data.name.split(" ")[0]}. Your inquiry is in my inbox. I'll review it and get back to you within 48 hours.\n\nJulian Perez Photography\njulianperezphotography.com`,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "inquire", stage: "client-confirmation" },
        level: "warning",
      });
    }

    // SMS confirmation — fire and forget. Only when the client supplied a
    // phone number. Failures never surface to the user (email already
    // succeeded; SMS is a nice-to-have nudge).
    if (data.phone) {
      try {
        const firstName = data.name.split(" ")[0];
        await sendSms(
          data.phone,
          `Thanks, ${firstName}! Your inquiry for ${serviceName} is in Julian's inbox. He'll reply within 48h. (Julian Perez Photography)`,
        );
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: "inquire", stage: "sms" },
          level: "warning",
        });
      }
    }

    return { ok: true };
  },
});

// Resolves to null if `promise` hasn't settled within `ms`.
function settleWithin<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// The owner's text: who, what, when and the channel, the verdict, and a
// one-line summary (or the opening of the message when there's no assessment),
// trimmed to fit sendSms's 320-character cap with the sign-off intact.
function ownerAlertText(m: {
  name: string;
  serviceName: string;
  eventDate?: string;
  referralLabel: string;
  triage: InquiryTriage | null;
  message: string;
}): string {
  const date = formatSubjectDate(m.eventDate).replace(/^ \((.*)\)$/, "$1");
  const head = [`New inquiry: ${m.name}`, m.serviceName, date, m.referralLabel && `via ${m.referralLabel}`]
    .filter(Boolean)
    .join(" · ");
  const verdict = m.triage ? ` (${triageVerdict(m.triage)})` : "";
  const tail = " Details in your inbox.";
  const room = Math.max(0, 320 - head.length - verdict.length - tail.length - 2);
  const gist = (m.triage?.summary || m.message).replace(/\s+/g, " ").trim();
  const body = gist.length > room ? `${gist.slice(0, Math.max(0, room - 1)).trimEnd()}…` : gist;
  return `${head}${verdict}. ${body}${tail}`;
}
