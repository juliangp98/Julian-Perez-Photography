export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { siteSettings, getService } from "@/lib/content";
import {
  BrandedEmailLayout,
  InquiryEmailTemplate,
  ClientConfirmationTemplate,
} from "@/lib/email-templates";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";
import { formatSubjectDate } from "@/lib/email-helpers";
import { REFERRAL_LABELS, formatReferral } from "@/lib/referral";
import { sendSms } from "@/lib/sms";

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

  const serviceName = getService(data.service)?.title || data.service;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev-mode fallback: log to console so you can iterate without Resend set up.
    console.log("[inquire] RESEND_API_KEY not set — logging inquiry instead:");
    console.log({ ...data, serviceName });
    return NextResponse.json({ ok: true, dev: true });
  }

  const resend = new Resend(apiKey);
  const fromAddress =
    process.env.RESEND_FROM || "Julian Perez Photography <onboarding@resend.dev>";
  const toAddress = process.env.INQUIRY_TO || siteSettings.contactEmail;

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
    `New inquiry from ${siteSettings.siteName}`,
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
    const msg =
      err instanceof Error ? err.message?.toLowerCase() ?? "" : "";
    const userMessage = msg.includes("valid")
      ? "The email address doesn't appear to be valid. Please double-check and try again."
      : msg.includes("rate")
        ? "Too many submissions — please wait a moment and try again."
        : `Could not send right now — please email ${siteSettings.contactEmail} directly.`;
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
      to: data.email,
      subject: "Thanks for your inquiry — Julian Perez Photography",
      html: confirmHtml,
      text: `Thank you, ${data.name.split(" ")[0]}. Your inquiry is in my inbox. I'll review it and get back to you within 48 hours.\n\nJulian Perez Photography\njulianperezphotography.com`,
    });
  } catch (err) {
    console.error("[inquire] Client confirmation error:", err);
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
    }
  }

  return NextResponse.json({ ok: true });
}
