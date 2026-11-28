// Transactional notification senders (server-only). Each renders the shared
// branded layout and sends through sendEmail(), which throws when an email
// doesn't go out; callers decide whether that fails their request.

import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  NotificationEmailTemplate,
  type NotificationItem,
} from "./email-templates";
import { sendEmail } from "./send";
import { getSiteSettings } from "@/lib/content";

// Where the owner's alerts go: INQUIRY_TO, else the studio address in Sanity.
export function ownerAddress(settings: { contactEmail: string }): string {
  return process.env.INQUIRY_TO || settings.contactEmail;
}

// An email to Julian in the branded notification layout. The text part reads
// the same: the heading, the lines, each item with its link, then the button's
// link. Throws when the email doesn't go out.
export async function emailOwner(email: {
  subject: string;
  // The inbox preview line; the heading when not given.
  preview?: string;
  heading: string;
  lines: string[];
  items?: NotificationItem[];
  cta: { label: string; href: string };
  idempotencyKey?: string;
}): Promise<void> {
  const settings = await getSiteSettings();
  const html = await render(
    BrandedEmailLayout({
      preview: email.preview ?? email.heading,
      children: NotificationEmailTemplate({
        heading: email.heading,
        lines: email.lines,
        items: email.items,
        cta: email.cta,
      }),
    }),
  );
  const text = [
    email.heading,
    ...email.lines,
    ...(email.items ?? []).map((i) => `${i.title}\n${i.text}\n${i.link.label}: ${i.link.href}`),
    // The button's arrow stays in the HTML.
    `${email.cta.label.replace(/\s*→$/, "")}: ${email.cta.href}`,
  ].join("\n\n");
  await sendEmail({
    sender: "site",
    to: ownerAddress(settings),
    subject: email.subject,
    html,
    text,
    ...(email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : {}),
  });
}

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
  await emailOwner(opts);
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
  const signIn = `${new URL(opts.inviteLink).origin}/portal`;
  const lines = [
    `I've shared the project "${opts.projectName}" with you for second-photographer access.`,
    "Sign in to see the shoot details, key dates, documents and the client's planning notes: everything you need to show up prepared. The button below signs you straight in.",
  ];
  const expiry = `This sign-in link expires in 20 minutes. For a fresh one, sign in at ${signIn}.`;
  const html = await render(
    BrandedEmailLayout({
      preview: `${settings.siteName} shared a project with you`,
      children: NotificationEmailTemplate({
        heading: "You've been added to a shoot",
        lines: [...lines, expiry],
        cta: { label: "Open the project →", href: opts.inviteLink },
      }),
    }),
  );
  await sendEmail({
    replyTo: settings.contactEmail,
    to: opts.to,
    subject: `${settings.siteName} shared "${opts.projectName}" with you`,
    html,
    text: `${lines.join("\n\n")}\n\nOpen the project: ${opts.inviteLink}\n\n${expiry}`,
  });
}
