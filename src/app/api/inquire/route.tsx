export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { getSiteSettings, getService } from "@/lib/content";
import {
  BrandedEmailLayout,
  InquiryEmailTemplate,
  ClientConfirmationTemplate,
} from "@/lib/email/email-templates";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";
import { formatSubjectDate, resendFrom } from "@/lib/email/email-helpers";
import { REFERRAL_LABELS, formatReferral } from "@/lib/referral";
import * as Sentry from "@sentry/nextjs";
import { sendSms } from "@/lib/sms";
import { upsertClientFromInquiry } from "@/lib/clients";
import { aiModel } from "@/lib/ai/ai";
import {
  assessInquiry,
  shouldAlertOwner,
  TRIAGE_FIT_LABEL,
  TRIAGE_URGENCY_LABEL,
  type InquiryTriage,
} from "@/lib/ai/triage";

// Cap on how long a submission waits for the AI assessment. Past it the owner
// email goes out without one (the admin "Triage this inquiry" button still
// works on the record).
const TRIAGE_TIMEOUT_MS = 8_000;

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

export async function POST(req: Request) {
  // Rate limit: 5 submissions / 10 min / IP — a legitimate client will
  // never hit this; a bot farm will.
  const limited = rateLimitResponse(req, {
    key: "inquire",
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again." },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Honeypot triggered — pretend success silently
  if (isHoneypotTriggered(data.hp_company)) {
    return NextResponse.json({ ok: true });
  }

  const apiKey = process.env.RESEND_API_KEY;

  // Resolve the curated referral value → friendly label, and fold in the
  // companion detail (which group, venue, or vendor) when present. Both
  // live in the email body; the shortform label also tags the subject line
  // so Julian can inbox-filter by source without opening the email.
  const referralLabel = data.referral
    ? REFERRAL_LABELS[data.referral] ?? data.referral
    : "";
  const referralDisplay = formatReferral(data.referral, data.referralOther);

  // Start the AI assessment now so its latency overlaps the content fetches
  // below. It resolves to null on any failure — an assessment is a bonus on
  // the owner email, never a reason to fail the submission. Skipped in the
  // dev-mode path, where nothing is sent.
  const triagePromise: Promise<InquiryTriage | null> = apiKey
    ? assessInquiry(
        {
          serviceType: data.service,
          clientName: data.name,
          eventDate: data.eventDate || undefined,
          budget: data.budget || undefined,
          venue: data.location || undefined,
          referral: referralDisplay === "—" ? undefined : referralDisplay,
          message: data.message,
        },
        { timeoutMs: TRIAGE_TIMEOUT_MS },
      ).catch((err: unknown) => {
        console.error("[inquire] triage error:", err);
        Sentry.captureException(err, {
          tags: { route: "inquire", stage: "triage", model: aiModel() },
          level: "warning",
        });
        return null;
      })
    : Promise.resolve(null);

  // getService + getSiteSettings are both async + React-cached. Fetch
  // them in parallel so the inquiry doesn't serialize two Sanity
  // round-trips on every submit.
  const [svc, settings] = await Promise.all([
    getService(data.service),
    getSiteSettings(),
  ]);
  const serviceName = svc?.title || data.service;

  if (!apiKey) {
    // Dev-mode fallback: log to console so you can iterate without Resend set up.
    console.log("[inquire] RESEND_API_KEY not set — logging inquiry instead:");
    console.log({ ...data, serviceName });
    return NextResponse.json({ ok: true, dev: true });
  }

  const resend = new Resend(apiKey);
  const fromAddress = resendFrom();
  const toAddress = process.env.INQUIRY_TO || settings.contactEmail;
  const triage = await triagePromise;

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
    ...(triage
      ? [
          ``,
          `── AI ASSESSMENT ──`,
          `${TRIAGE_FIT_LABEL[triage.fit]} · ${TRIAGE_URGENCY_LABEL[triage.urgency]}`,
          triage.summary,
          [triage.fitReason, triage.urgencyReason].filter(Boolean).join(" "),
          ...(triage.suggestedReply
            ? [``, `Suggested reply (draft — edit before sending):`, triage.suggestedReply]
            : []),
        ]
      : []),
  ].join("\n");

  // Override the raw referral value with the friendly display string so the
  // branded template shows "Instagram" (or "Venue — Foxchase Manor")
  // rather than the internal slug.
  const emailData = { ...data, referral: referralDisplay === "—" ? undefined : referralDisplay };
  // The preheader is what an inbox or lock screen shows under the subject, so
  // it leads with the verdict when there is one.
  const preview = triage
    ? `${TRIAGE_FIT_LABEL[triage.fit]} · ${TRIAGE_URGENCY_LABEL[triage.urgency]} — ${triage.summary}`
    : `New inquiry from ${data.name} — ${serviceName}`;
  const html = await render(
    <BrandedEmailLayout preview={preview}>
      <InquiryEmailTemplate data={emailData} serviceName={serviceName} triage={triage} />
    </BrandedEmailLayout>,
  );

  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: toAddress,
      replyTo: data.email,
      subject,
      html,
      text,
    });
    if (error) throw error;
  } catch (err: unknown) {
    console.error("[inquire] Resend error:", err);
    Sentry.captureException(err, {
      tags: { route: "inquire", stage: "owner-email" },
    });
    const msg =
      err instanceof Error ? err.message?.toLowerCase() ?? "" : "";
    const userMessage = msg.includes("valid")
      ? "The email address doesn't appear to be valid. Please double-check and try again."
      : msg.includes("rate")
        ? "Too many submissions — please wait a moment and try again."
        : `Could not send right now — please email ${settings.contactEmail} directly.`;
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }

  // Client confirmation email — fire and forget; don't fail the submission.
  try {
    const confirmHtml = await render(
      <BrandedEmailLayout preview="Thanks for reaching out — I'll be in touch soon">
        <ClientConfirmationTemplate clientName={data.name} />
      </BrandedEmailLayout>,
    );
    await resend.emails.send({
      from: fromAddress,
      replyTo: settings.contactEmail,
      to: data.email,
      subject: "Thanks for your inquiry — Julian Perez Photography",
      html: confirmHtml,
      text: `Thank you, ${data.name.split(" ")[0]}. Your inquiry is in my inbox. I'll review it and get back to you within 48 hours.\n\nJulian Perez Photography\njulianperezphotography.com`,
    });
  } catch (err) {
    console.error("[inquire] Client confirmation error:", err);
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
      console.error("[inquire] SMS error:", err);
      Sentry.captureException(err, {
        tags: { route: "inquire", stage: "sms" },
        level: "warning",
      });
    }
  }

  // Owner text alert — fire and forget. Opt-in via INQUIRY_SMS_TO, and only
  // for the leads worth an interruption (see `shouldAlertOwner`); the full
  // details and the draft reply are already in the owner email.
  const ownerPhone = process.env.INQUIRY_SMS_TO;
  if (ownerPhone && shouldAlertOwner(triage)) {
    try {
      await sendSms(
        ownerPhone,
        ownerAlertText({
          name: data.name,
          serviceName,
          eventDate: data.eventDate,
          referralLabel,
          triage,
          message: data.message,
        }),
      );
    } catch (err) {
      console.error("[inquire] owner SMS error:", err);
      Sentry.captureException(err, {
        tags: { route: "inquire", stage: "owner-sms" },
        level: "warning",
      });
    }
  }

  // Durable capture — upsert a client record so the inquiry isn't lost to the
  // inbox. Fire-and-forget: the email has already succeeded, so a
  // store failure (or an unconfigured store) must never fail the submission.
  // `upsertClientFromInquiry` no-ops when the private store isn't configured.
  try {
    await upsertClientFromInquiry({
      name: data.name,
      email: data.email,
      phone: data.phone || undefined,
      service: data.service,
      eventDate: data.eventDate || undefined,
      location: data.location || undefined,
      budget: data.budget || undefined,
      // `formatReferral` renders a blank source as "—" for the email; the
      // record leaves it empty so source tallies only count real answers.
      referral: referralDisplay === "—" ? undefined : referralDisplay,
      message: data.message,
      projectId: data.project || undefined,
    });
  } catch (err) {
    console.error("[inquire] client-record upsert error:", err);
    Sentry.captureException(err, {
      tags: { route: "inquire", stage: "client-record" },
      level: "warning",
    });
  }

  return NextResponse.json({ ok: true });
}

// The owner alert: who, what, when, the verdict, and a one-line summary (or
// the opening of the message when there's no assessment). `sendSms` hard-caps
// the body, so the summary is trimmed here to keep the sign-off intact.
function ownerAlertText({
  name,
  serviceName,
  eventDate,
  referralLabel,
  triage,
  message,
}: {
  name: string;
  serviceName: string;
  eventDate?: string;
  referralLabel: string;
  triage: InquiryTriage | null;
  message: string;
}): string {
  const head = [
    `New inquiry: ${name}`,
    serviceName,
    formatSubjectDate(eventDate).replace(/^ — /, ""),
    referralLabel ? `via ${referralLabel}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const verdict = triage
    ? ` (${TRIAGE_FIT_LABEL[triage.fit]}, ${TRIAGE_URGENCY_LABEL[triage.urgency].toLowerCase()})`
    : "";
  const tail = triage ? " Draft reply is in your inbox." : " Details in your inbox.";
  const room = Math.max(0, 320 - head.length - verdict.length - tail.length - 2);
  const gist = (triage?.summary || message).replace(/\s+/g, " ").trim();
  const body = gist.length > room ? `${gist.slice(0, Math.max(0, room - 1)).trimEnd()}…` : gist;
  return `${head}${verdict}. ${body}${tail}`;
}
