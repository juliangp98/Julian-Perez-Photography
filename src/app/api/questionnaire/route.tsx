export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { siteSettings, getService } from "@/lib/content";
import {
  getQuestionnaire,
  evaluateShowIf,
  visibleSectionsFor,
} from "@/lib/questionnaires";
import {
  BrandedEmailLayout,
  QuestionnaireEmailTemplate,
  ClientConfirmationTemplate,
} from "@/lib/email-templates";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";
import { formatSubjectDate } from "@/lib/email-helpers";
import { REFERRAL_LABELS, formatReferral } from "@/lib/referral";
import { sendSms } from "@/lib/sms";

type Answers = Record<string, string | string[]>;

type UploadedFile = { url: string; name: string; size?: number };

// Parse a file-field value. The client stores `{ url, name, size }[]` as a
// JSON-encoded string so it fits the existing string|string[] value type.
function parseFiles(v: unknown): UploadedFile[] {
  if (typeof v !== "string" || !v) return [];
  try {
    const parsed = JSON.parse(v);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is UploadedFile =>
        f && typeof f.url === "string" && typeof f.name === "string",
    );
  } catch {
    return [];
  }
}

// Emptiness check that understands file fields (an empty JSON array `"[]"` is
// empty). Mirrors the client's `isFieldEmpty` in QuestionnaireForm.tsx.
function isAnswerEmpty(type: string, v: unknown): boolean {
  if (v === undefined || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (type === "file") return parseFiles(v).length === 0;
  return false;
}

export async function POST(req: Request) {
  // Rate limit: 5 submissions / 10 min / IP. Questionnaires are longer
  // than inquiries — the real risk here is abuse, not legitimate volume.
  const limited = rateLimitResponse(req, {
    key: "questionnaire",
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: { service?: string; hp_company?: string; answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot — silently succeed.
  if (isHoneypotTriggered(body.hp_company)) return NextResponse.json({ ok: true });

  const slug = body.service;
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing service" }, { status: 400 });
  }

  const q = getQuestionnaire(slug);
  if (!q) {
    return NextResponse.json(
      { error: "Unknown questionnaire" },
      { status: 400 },
    );
  }

  const answers = body.answers || {};

  // Validate required fields against the schema, mirroring the same showIf
  // logic the form uses. Sections hidden by their own showIf clause are
  // skipped wholesale — fields inside them aren't required and shouldn't be
  // emailed even if a stale draft submitted them.
  const visibleSections = visibleSectionsFor(q, answers);
  for (const section of visibleSections) {
    for (const f of section.fields) {
      if (!f.required) continue;
      if (!evaluateShowIf(f.showIf, answers)) continue;
      if (isAnswerEmpty(f.type, answers[f.id])) {
        return NextResponse.json(
          { error: `Missing required field: ${f.label}` },
          { status: 400 },
        );
      }
    }
  }

  // Length sanity caps to keep email payloads reasonable.
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === "string" && v.length > 5000) {
      return NextResponse.json(
        { error: `Field ${k} is too long.` },
        { status: 400 },
      );
    }
  }

  const svc = getService(slug);
  const serviceTitle = svc?.title || slug;
  const clientName =
    (typeof answers["fullName"] === "string" && answers["fullName"]) ||
    "Unknown client";
  const clientEmail =
    typeof answers["email"] === "string" ? answers["email"] : undefined;
  const submittedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const isWedding = slug === "weddings";

  // ── Build structured sections for the branded email template ──

  const emailSections: {
    title: string;
    fields: { label: string; value: string; isFile?: boolean }[];
  }[] = [];

  // Also build a plain-text fallback alongside.
  const lines: string[] = [];
  lines.push(`New questionnaire — ${q.title}`);
  lines.push(`Service: ${serviceTitle}`);
  lines.push(`Submitted: ${submittedAt}`);
  lines.push("");

  for (const section of visibleSections) {
    const sectionVisibleFields = section.fields.filter((f) =>
      evaluateShowIf(f.showIf, answers),
    );
    const populatedFields = sectionVisibleFields.filter(
      (f) => !isAnswerEmpty(f.type, answers[f.id]),
    );
    if (populatedFields.length === 0) continue;

    const emailFields: {
      label: string;
      value: string;
      isFile?: boolean;
    }[] = [];
    lines.push(`── ${section.title.toUpperCase()} ──`);

    for (const f of populatedFields) {
      const v = answers[f.id];
      // `referral` renders as the friendly label (+ "Other" free-text
      // detail if supplied). `referralOther` is a companion field only
      // — skip its own row so we don't duplicate the detail.
      if (f.id === "referral") {
        const referralRaw = typeof v === "string" ? v : "";
        const otherRaw = typeof answers["referralOther"] === "string"
          ? (answers["referralOther"] as string)
          : "";
        const display = formatReferral(referralRaw, otherRaw);
        emailFields.push({ label: f.label, value: display });
        lines.push(`${f.label}:`);
        lines.push(`  ${display}`);
        lines.push("");
        continue;
      }
      if (f.id === "referralOther") continue;
      if (f.type === "file") {
        const files = parseFiles(v);
        const htmlLinks = files
          .map((file) => `• <a href="${file.url}">${file.name}</a>`)
          .join("<br/>");
        emailFields.push({ label: f.label, value: htmlLinks, isFile: true });
        lines.push(`${f.label}:`);
        for (const file of files) {
          lines.push(`  • ${file.name} — ${file.url}`);
        }
        lines.push("");
        continue;
      }
      const display = Array.isArray(v) ? v.join(", ") : String(v);
      emailFields.push({ label: f.label, value: display });
      lines.push(`${f.label}:`);
      lines.push(`  ${display.split("\n").join("\n  ")}`);
      lines.push("");
    }

    emailSections.push({ title: section.title, fields: emailFields });
  }

  const text = lines.join("\n");
  // Prefer wedding-specific field, fall back to generic. Either way
  // missing/unparseable values render as an empty string.
  const eventDateForSubject =
    (typeof answers["weddingDate"] === "string" && answers["weddingDate"]) ||
    (typeof answers["eventDate"] === "string" && answers["eventDate"]) ||
    "";
  // Tag the subject line with the referral source so Julian can inbox-
  // filter by channel without opening each email.
  const referralRaw =
    typeof answers["referral"] === "string" ? (answers["referral"] as string) : "";
  const referralLabel = referralRaw
    ? REFERRAL_LABELS[referralRaw] ?? referralRaw
    : "";
  const subject = `New questionnaire — ${serviceTitle} — ${clientName}${formatSubjectDate(eventDateForSubject)}${referralLabel ? ` [via: ${referralLabel}]` : ""}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback
    console.log("[questionnaire] RESEND_API_KEY not set — logging instead:");
    console.log(text);
    return NextResponse.json({ ok: true, dev: true });
  }

  const resend = new Resend(apiKey);
  const fromAddress =
    process.env.RESEND_FROM ||
    "Julian Perez Photography <onboarding@resend.dev>";
  const toAddress = process.env.INQUIRY_TO || siteSettings.contactEmail;

  // ── Wedding-specific: generate PDF ──

  const warnings: string[] = [];
  let pdfBuffer: Buffer | null = null;

  if (isWedding) {
    try {
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const { WeddingDayPlan } = await import("@/lib/wedding-day-plan");
      pdfBuffer = await renderToBuffer(
        <WeddingDayPlan answers={answers} />,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[questionnaire] PDF generation error:", detail);
      warnings.push(`PDF generation failed: ${detail}`);
    }
  }

  // ── Send Julian's email ──

  const html = await render(
    <BrandedEmailLayout
      preview={`New ${q.title.toLowerCase()} from ${clientName}`}
    >
      <QuestionnaireEmailTemplate
        questionnaireTitle={q.title}
        serviceTitle={serviceTitle}
        submittedAt={submittedAt}
        sections={emailSections}
        hasPdf={!!pdfBuffer}
      />
    </BrandedEmailLayout>,
  );

  const attachments: { filename: string; content: Buffer }[] = [];
  if (pdfBuffer) {
    attachments.push({
      filename: "Wedding-Day-Plan.pdf",
      content: pdfBuffer,
    });
  }

  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: toAddress,
      replyTo: clientEmail,
      subject,
      html,
      text,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    if (error) throw error;
  } catch (err: unknown) {
    console.error("[questionnaire] Resend error:", err);
    const msg =
      err instanceof Error ? err.message?.toLowerCase() ?? "" : "";
    const userMessage = msg.includes("valid")
      ? "The email address doesn't appear to be valid. Please double-check and try again."
      : msg.includes("rate")
        ? "Too many submissions — please wait a moment and try again."
        : `Could not send right now — please email ${siteSettings.contactEmail} directly.`;
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }

  // ── Client confirmation email — fire and forget ──

  if (clientEmail) {
    try {
      const confirmHtml = await render(
        <BrandedEmailLayout
          preview={`Thanks for your ${q.title.toLowerCase()} — I'll be in touch soon`}
        >
          <ClientConfirmationTemplate
            clientName={clientName}
            questionnaireTitle={q.title}
            isWedding={isWedding}
            hasPdf={!!pdfBuffer}
          />
        </BrandedEmailLayout>,
      );

      const confirmAttachments: { filename: string; content: Buffer }[] = [];
      if (pdfBuffer) {
        confirmAttachments.push({
          filename: "Wedding-Day-Plan.pdf",
          content: pdfBuffer,
        });
      }

      await resend.emails.send({
        from: fromAddress,
        to: clientEmail,
        subject: `Thanks for your ${q.title.toLowerCase()} — Julian Perez Photography`,
        html: confirmHtml,
        text: `Thank you, ${clientName.split(" ")[0]}. Your planning questionnaire is in my inbox. I'll review everything and reach out within 48 hours.\n\nJulian Perez Photography\njulianperezphotography.com`,
        ...(confirmAttachments.length > 0
          ? { attachments: confirmAttachments }
          : {}),
      });
    } catch (err) {
      console.error("[questionnaire] Client confirmation error:", err);
    }
  }

  // SMS confirmation — fire and forget. Every questionnaire shares the
  // `yourDetailsSection` block, which includes a required phone number,
  // so this path is available on all services.
  const clientPhone =
    typeof answers["phone"] === "string" ? (answers["phone"] as string) : "";
  if (clientPhone) {
    try {
      const firstName = clientName.split(" ")[0];
      await sendSms(
        clientPhone,
        `Thanks, ${firstName}! Your ${serviceTitle} questionnaire is received. Julian will review and reply within 48h.`,
      );
    } catch (err) {
      console.error("[questionnaire] SMS error:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
