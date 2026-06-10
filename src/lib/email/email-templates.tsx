// Branded React Email templates for inquiry and questionnaire submissions.
//
// These templates are rendered server-side via `render()` from
// @react-email/components and passed to Resend as HTML. A plain-text fallback
// is always included alongside the HTML for email clients that don't render it.

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
  Preview,
} from "@react-email/components";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Brand tokens (mirrored from globals.css)
// ---------------------------------------------------------------------------

const ACCENT = "#8a6e4b";
const FOREGROUND = "#0e0e0e";
const MUTED = "#6b6b6b";
const BG = "#fafaf7";
const BORDER = "#e7e4dd";

// Email-safe font stacks (custom fonts don't reliably render in email clients)
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------

export function BrandedEmailLayout({
  preview,
  children,
}: {
  preview?: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body
        style={{
          backgroundColor: BG,
          fontFamily: SANS,
          color: FOREGROUND,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "40px 24px",
          }}
        >
          {/* Header */}
          <Text
            style={{
              fontFamily: SERIF,
              fontSize: "22px",
              fontWeight: "normal",
              color: FOREGROUND,
              margin: "0 0 4px 0",
            }}
          >
            Julian Perez Photography
          </Text>
          <Hr
            style={{
              borderColor: ACCENT,
              borderWidth: "2px",
              width: "60px",
              margin: "0 0 32px 0",
              borderStyle: "solid",
            }}
          />

          {/* Content */}
          {children}

          {/* Footer */}
          <Hr
            style={{
              borderColor: BORDER,
              margin: "40px 0 24px 0",
            }}
          />
          <Text
            style={{
              fontSize: "12px",
              color: MUTED,
              lineHeight: "20px",
              margin: 0,
            }}
          >
            Based in NOVA · Serving the DMV
            <br />
            <Link
              href="https://julianperezphotography.com"
              style={{ color: ACCENT }}
            >
              julianperezphotography.com
            </Link>
            {" · "}
            <Link
              href="mailto:juliangperez98@gmail.com"
              style={{ color: ACCENT }}
            >
              juliangperez98@gmail.com
            </Link>
          </Text>
          <Text
            style={{
              fontSize: "12px",
              color: MUTED,
              margin: "8px 0 0 0",
            }}
          >
            <Link
              href="https://instagram.com/julianperezphotography"
              style={{ color: ACCENT }}
            >
              Instagram
            </Link>
            {" · "}
            <Link
              href="https://facebook.com/julianperezphotographyllc"
              style={{ color: ACCENT }}
            >
              Facebook
            </Link>
            {" · "}
            <Link
              href="https://youtube.com/@julianperezphotography"
              style={{ color: ACCENT }}
            >
              YouTube
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Inquiry email (sent to Julian)
// ---------------------------------------------------------------------------

type InquiryData = {
  name: string;
  email: string;
  phone?: string;
  service: string;
  eventDate?: string;
  location?: string;
  budget?: string;
  referral?: string;
  message: string;
};

export function InquiryEmailTemplate({
  data,
  serviceName,
}: {
  data: InquiryData;
  serviceName: string;
}) {
  const fields: [string, string | undefined][] = [
    ["Name", data.name],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Service", serviceName],
    ["Date", data.eventDate],
    ["Location", data.location],
    ["Budget", data.budget],
    ["Referral", data.referral],
  ];

  return (
    <>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: "20px",
          color: FOREGROUND,
          margin: "0 0 24px 0",
        }}
      >
        New inquiry
      </Text>

      {fields.map(([label, value]) =>
        value ? (
          <Text
            key={label}
            style={{
              fontSize: "14px",
              color: FOREGROUND,
              margin: "0 0 6px 0",
              lineHeight: "20px",
            }}
          >
            <span style={{ color: MUTED }}>{label}:</span> {value}
          </Text>
        ) : null,
      )}

      <Section
        style={{
          borderLeft: `3px solid ${ACCENT}`,
          paddingLeft: "16px",
          margin: "20px 0",
        }}
      >
        <Text
          style={{
            fontSize: "12px",
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            color: MUTED,
            margin: "0 0 8px 0",
          }}
        >
          Message
        </Text>
        <Text
          style={{
            fontSize: "14px",
            color: FOREGROUND,
            lineHeight: "22px",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {data.message}
        </Text>
      </Section>

      <Text style={{ fontSize: "12px", color: MUTED, margin: "16px 0 0 0" }}>
        Reply directly to this email to respond to {data.name}.
      </Text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Questionnaire email (sent to Julian)
// ---------------------------------------------------------------------------

// A field is either a plain `value` (string) or a `files` array for uploaded
// attachments. Keeping the arms as discrete properties — rather than a single
// HTML string — lets the renderer emit real `<a>` elements so React's
// auto-escaping handles any filename characters safely. Filenames originate
// from client uploads and must never be trusted as HTML.
type EmailFieldValue =
  | { label: string; value: string }
  | { label: string; files: { url: string; name: string }[] };

type SectionBlock = {
  title: string;
  fields: EmailFieldValue[];
};

export function QuestionnaireEmailTemplate({
  questionnaireTitle,
  serviceTitle,
  submittedAt,
  sections,
  hasPdf,
}: {
  questionnaireTitle: string;
  serviceTitle: string;
  submittedAt: string;
  sections: SectionBlock[];
  hasPdf?: boolean;
}) {
  return (
    <>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: "20px",
          color: FOREGROUND,
          margin: "0 0 4px 0",
        }}
      >
        {questionnaireTitle}
      </Text>
      <Text style={{ fontSize: "13px", color: MUTED, margin: "0 0 24px 0" }}>
        {serviceTitle} · {submittedAt}
      </Text>

      {hasPdf && (
        <Section
          style={{
            backgroundColor: "#ffffff",
            border: `1px solid ${ACCENT}`,
            borderRadius: "8px",
            padding: "16px 20px",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              fontSize: "13px",
              color: FOREGROUND,
              margin: "0",
            }}
          >
            Wedding Day Plan PDF is attached to this email.
          </Text>
        </Section>
      )}

      {sections.map((section, si) => (
        <Section key={si} style={{ margin: "0 0 24px 0" }}>
          <Text
            style={{
              fontSize: "11px",
              textTransform: "uppercase" as const,
              letterSpacing: "0.15em",
              color: ACCENT,
              fontWeight: "bold",
              margin: "0 0 12px 0",
              borderBottom: `1px solid ${BORDER}`,
              paddingBottom: "6px",
            }}
          >
            {section.title}
          </Text>
          {section.fields.map((field, fi) => (
            <div key={fi} style={{ margin: "0 0 10px 0" }}>
              <Text
                style={{
                  fontSize: "12px",
                  color: MUTED,
                  margin: "0 0 2px 0",
                }}
              >
                {field.label}
              </Text>
              {"files" in field ? (
                // File-attachment fields render as real React links so the
                // filename (which is user-supplied) is escaped by React
                // rather than concatenated into an HTML string.
                <div
                  style={{
                    fontSize: "14px",
                    color: FOREGROUND,
                    lineHeight: "22px",
                    margin: 0,
                  }}
                >
                  {field.files.map((file, i) => (
                    <div key={i}>
                      •{" "}
                      <Link
                        href={file.url}
                        style={{ color: ACCENT, textDecoration: "underline" }}
                      >
                        {file.name}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <Text
                  style={{
                    fontSize: "14px",
                    color: FOREGROUND,
                    lineHeight: "22px",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {field.value}
                </Text>
              )}
            </div>
          ))}
        </Section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Client confirmation email (sent to the client)
// ---------------------------------------------------------------------------

export function ClientConfirmationTemplate({
  clientName,
  questionnaireTitle,
  isWedding,
  hasPdf,
}: {
  clientName: string;
  questionnaireTitle?: string;
  isWedding?: boolean;
  hasPdf?: boolean;
}) {
  const isQuestionnaire = !!questionnaireTitle;

  return (
    <>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: "24px",
          color: FOREGROUND,
          margin: "0 0 16px 0",
        }}
      >
        Thank you, {clientName.split(" ")[0]}.
      </Text>

      <Text
        style={{
          fontSize: "15px",
          color: FOREGROUND,
          lineHeight: "24px",
          margin: "0 0 24px 0",
        }}
      >
        {isQuestionnaire
          ? `Your ${questionnaireTitle?.toLowerCase().replace(" questionnaire", "")} questionnaire is in my inbox. I'll review everything and reach out with next steps within 48 hours.`
          : "Your inquiry is in my inbox. I'll review it and get back to you within 48 hours."}
      </Text>

      {isWedding && hasPdf && (
        <Section
          style={{
            backgroundColor: "#ffffff",
            border: `1px solid ${ACCENT}`,
            borderRadius: "8px",
            padding: "20px 24px",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              fontFamily: SERIF,
              fontSize: "16px",
              color: FOREGROUND,
              margin: "0 0 12px 0",
            }}
          >
            Your Wedding Day Plan
          </Text>
          <Text
            style={{
              fontSize: "13px",
              color: MUTED,
              margin: "0",
              lineHeight: "20px",
            }}
          >
            A PDF copy of your Wedding Day Plan is attached to this email —
            feel free to save or print it.
          </Text>
        </Section>
      )}

      <Text style={{ fontSize: "14px", color: MUTED, lineHeight: "22px" }}>
        In the meantime, feel free to reply to this email with any questions.
      </Text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared pill button
// ---------------------------------------------------------------------------

function PillButton({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Link
        href={href}
        style={{
          backgroundColor: FOREGROUND,
          color: "#ffffff",
          padding: "12px 24px",
          borderRadius: "9999px",
          textDecoration: "none",
          fontSize: "14px",
          display: "inline-block",
        }}
      >
        {label}
      </Link>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Magic-link sign-in email (portal client or admin)
// ---------------------------------------------------------------------------

export function MagicLinkEmailTemplate({
  link,
  kind,
}: {
  link: string;
  kind: "portal" | "admin";
}) {
  const isAdmin = kind === "admin";
  return (
    <>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: "20px",
          color: FOREGROUND,
          margin: "0 0 16px 0",
        }}
      >
        {isAdmin ? "Your admin sign-in link" : "Your sign-in link"}
      </Text>
      <Text
        style={{
          fontSize: "15px",
          color: FOREGROUND,
          lineHeight: "24px",
          margin: "0 0 8px 0",
        }}
      >
        {isAdmin
          ? "Here's your secure link to the admin dashboard."
          : "Here's your secure link to your client portal — no password needed."}
      </Text>
      <PillButton
        href={link}
        label={isAdmin ? "Open the admin dashboard →" : "Open your portal →"}
      />
      <Text
        style={{ fontSize: "13px", color: MUTED, lineHeight: "20px", margin: 0 }}
      >
        This link expires in 20 minutes and can only be used once. If you
        didn&rsquo;t request it, you can safely ignore this email.
      </Text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Generic notification email (sign-in-free updates to a client or to Julian)
// ---------------------------------------------------------------------------

export function NotificationEmailTemplate({
  heading,
  lines,
  changes,
  cta,
}: {
  heading: string;
  lines: string[];
  // Optional structured list of what changed, rendered as an accent callout.
  changes?: string[];
  cta?: { label: string; href: string };
}) {
  return (
    <>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: "20px",
          color: FOREGROUND,
          margin: "0 0 16px 0",
        }}
      >
        {heading}
      </Text>
      {lines.map((line, i) => (
        <Text
          key={i}
          style={{
            fontSize: "15px",
            color: FOREGROUND,
            lineHeight: "24px",
            margin: "0 0 12px 0",
          }}
        >
          {line}
        </Text>
      ))}
      {changes && changes.length > 0 && (
        <Section
          style={{
            margin: "4px 0 20px 0",
            padding: "6px 18px",
            backgroundColor: "#f6f3ec",
            border: `1px solid ${BORDER}`,
            borderLeft: `3px solid ${ACCENT}`,
            borderRadius: "4px",
          }}
        >
          {changes.map((change, i) => (
            <Text
              key={i}
              style={{
                fontFamily: SANS,
                fontSize: "15px",
                color: FOREGROUND,
                lineHeight: "22px",
                margin: "8px 0",
              }}
            >
              {change}
            </Text>
          ))}
        </Section>
      )}
      {cta && <PillButton href={cta.href} label={cta.label} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pipeline email (a freeform, Julian-edited body — see email-pipeline.ts)
// ---------------------------------------------------------------------------

// Turn bare URLs in a paragraph into branded accent links.
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <Link
        key={i}
        href={part}
        style={{ color: ACCENT, textDecoration: "underline" }}
      >
        {part}
      </Link>
    ) : (
      part
    ),
  );
}

// Render the (edited) body as branded paragraphs with clickable links.
// Paragraphs are blank-line separated; single newlines become line breaks.
export function PipelineEmailTemplate({ body }: { body: string }) {
  return (
    <>
      {body.split(/\n{2,}/).map((p, i) => (
        <Text
          key={i}
          style={{
            fontSize: "15px",
            color: FOREGROUND,
            lineHeight: "24px",
            margin: "0 0 16px 0",
            whiteSpace: "pre-line",
          }}
        >
          {linkify(p)}
        </Text>
      ))}
    </>
  );
}
