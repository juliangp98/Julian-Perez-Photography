// POST /api/inquire: public inquiry form. Emails the owner (the only step that can
// fail the submission), then records the client and sends the client email and
// text confirmations as best-effort side effects.

export const runtime = "nodejs";

import { z } from "zod";
import { render } from "@react-email/components";
import { getSiteSettings, getService } from "@/lib/content";
import {
  BrandedEmailLayout,
  InquiryEmailTemplate,
  ClientConfirmationTemplate,
} from "@/lib/email/email-templates";
import { apiError, defineRoute } from "@/lib/api-route";
import { formatSubjectDate } from "@/lib/email/email-helpers";
import { sendEmail } from "@/lib/email/send";
import { REFERRAL_LABELS, formatReferral } from "@/lib/referral";
import * as Sentry from "@sentry/nextjs";
import { sendSms } from "@/lib/sms";
import { upsertClientFromInquiry } from "@/lib/clients";

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
  run: async (data) => {
    // getService + getSiteSettings are both async + React-cached. Fetch
    // them in parallel so the inquiry doesn't serialize two Sanity
    // round-trips on every submit.
    const [svc, settings] = await Promise.all([
      getService(data.service),
      getSiteSettings(),
    ]);
    const serviceName = svc?.title || data.service;

    const toAddress = process.env.INQUIRY_TO || settings.contactEmail;

    // Resolve the curated referral value → friendly label, and fold in the
    // free-text "Other" detail when present. Both live in the email body;
    // the shortform label also tags the subject line so Julian can inbox-
    // filter by source without opening the email.
    const referralLabel = data.referral
      ? REFERRAL_LABELS[data.referral] ?? data.referral
      : "";
    const referralDisplay = formatReferral(data.referral, data.referralOther);

    // Include the event date in the subject when supplied — makes triage
    // easier when multiple inquiries for the same service land in a row.
    const subject = `New inquiry — ${serviceName} — ${data.name}${formatSubjectDate(data.eventDate)}${referralLabel ? ` [via: ${referralLabel}]` : ""}`;
    const text = [
      `New inquiry from ${settings.siteName}`,
      ``,
      `Name:      ${data.name}`,
      `Email:     ${data.email}`,
      `Phone:     ${data.phone || "—"}`,
      `Service:   ${serviceName}`,
      `Date:      ${data.eventDate || "—"}`,
      `Location:  ${data.location || "—"}`,
      `Budget:    ${data.budget || "—"}`,
      `Referral:  ${referralDisplay}`,
      ``,
      `Message:`,
      data.message,
    ].join("\n");

    // Override the raw referral value with the friendly display string so the
    // branded template shows "Instagram" (or "Other — at a friend's reception")
    // rather than the internal slug.
    const emailData = { ...data, referral: referralDisplay === "—" ? undefined : referralDisplay };
    const html = await render(
      <BrandedEmailLayout preview={`New inquiry from ${data.name} — ${serviceName}`}>
        <InquiryEmailTemplate data={emailData} serviceName={serviceName} />
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

    // Durable capture: upsert a client record so the inquiry isn't lost to the
    // inbox. It runs before the confirmation so that email starts the project's
    // thread. The owner email has already gone, so a store failure (or an
    // unconfigured store) never fails the submission.
    let projectId: string | null = null;
    try {
      projectId = await upsertClientFromInquiry({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        service: data.service,
        eventDate: data.eventDate || undefined,
        location: data.location || undefined,
        budget: data.budget || undefined,
        referral: formatReferral(data.referral, data.referralOther) || undefined,
        message: data.message,
        projectId: data.project || undefined,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: "inquire", stage: "client-record" },
        level: "warning",
      });
    }

    // Client confirmation email — fire and forget; don't fail the submission.
    try {
      const confirmHtml = await render(
        <BrandedEmailLayout preview="Thanks for reaching out — I'll be in touch soon">
          <ClientConfirmationTemplate clientName={data.name} />
        </BrandedEmailLayout>,
      );
      await sendEmail({
        replyTo: settings.contactEmail,
        to: data.email,
        ...(projectId ? { thread: { projectId, kind: "confirmation" as const } } : {}),
        subject: "Thanks for your inquiry — Julian Perez Photography",
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
          `Thanks, ${firstName}! Your inquiry for ${serviceName} is in Julian's inbox. He'll reply within 48h. — Julian Perez Photography`,
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
