// Transactional notification senders (server-only). Each renders the shared
// branded layout and sends through sendEmail(), which throws when an email
// doesn't go out; callers decide whether that fails their request.

import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  NotificationEmailTemplate,
} from "./email-templates";
import { sendEmail } from "./send";
import { getSiteSettings } from "@/lib/content";

// Whether Julian is emailed about what clients do in the portal (edit their
// details, start a project, upload a file). Defaults on; set
// NOTIFY_CLIENT_EDITS=false to mute them.
export function portalNotifyEnabled(): boolean {
  return process.env.NOTIFY_CLIENT_EDITS !== "false";
}

// Tell Julian what a client did in the portal, with a link to the project.
// Throws when the email doesn't go out; callers report it at warning, since
// what the client did has already been saved.
export async function notifyOwnerOfPortal(opts: {
  subject: string;
  heading: string;
  lines: string[];
  cta: { label: string; href: string };
}): Promise<void> {
  if (!portalNotifyEnabled()) return;
  const settings = await getSiteSettings();
  const to = process.env.INQUIRY_TO || settings.contactEmail;
  const html = await render(
    BrandedEmailLayout({
      preview: opts.heading,
      children: NotificationEmailTemplate({ heading: opts.heading, lines: opts.lines, cta: opts.cta }),
    }),
  );
  await sendEmail({
    to,
    subject: opts.subject,
    html,
    text: `${opts.lines.join("\n\n")}\n\n${opts.cta.label}: ${opts.cta.href}`,
  });
}

// Invite a second photographer to a project they've been granted read access to.
// `inviteLink` is a one-click portal sign-in link minted by the caller (which
// has the request origin).
export async function sendCollaboratorInviteEmail(opts: {
  to: string;
  projectName: string;
  inviteLink: string;
}): Promise<void> {
  const settings = await getSiteSettings();
  const lines = [
    `Julian has shared the project "${opts.projectName}" with you for second-photographer access.`,
    "Sign in to view the shoot details, key dates, documents, and the couple's planning notes: everything you need to show up prepared. The button below signs you straight in.",
  ];
  const html = await render(
    BrandedEmailLayout({
      preview: `${settings.siteName} shared a project with you`,
      children: NotificationEmailTemplate({
        heading: "You've been added to a shoot",
        lines,
        cta: { label: "Open the project →", href: opts.inviteLink },
      }),
    }),
  );
  await sendEmail({
    replyTo: settings.contactEmail,
    to: opts.to,
    subject: `${settings.siteName} shared "${opts.projectName}" with you`,
    html,
    text: `${lines.join("\n\n")}\n\nOpen the project: ${opts.inviteLink}\n\nThis sign-in link expires in 20 minutes; you can always request a fresh one at the portal sign-in page.`,
  });
}
