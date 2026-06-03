// Transactional notification senders (server-only). Each renders the shared
// branded layout and sends via Resend; all are fire-and-forget and no-op when
// Resend isn't configured, so a missing key never breaks the primary request.

import { Resend } from "resend";
import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  NotificationEmailTemplate,
} from "./email-templates";

function resendFrom(): string {
  return (
    process.env.RESEND_FROM ||
    "Julian Perez Photography <onboarding@resend.dev>"
  );
}

// Notify a client that their project was updated. `lines` is the body copy;
// the email always carries a "sign in to your portal" call to action.
export async function sendClientUpdateEmail(opts: {
  to?: string;
  firstName?: string;
  projectName: string;
  portalUrl: string;
  lines: string[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !opts.to) return;

  const heading = opts.firstName
    ? `Hi ${opts.firstName},`
    : "An update on your project";
  const html = await render(
    BrandedEmailLayout({
      preview: `An update on ${opts.projectName}`,
      children: NotificationEmailTemplate({
        heading,
        lines: opts.lines,
        cta: { label: "Open your portal →", href: opts.portalUrl },
      }),
    }),
  );

  await new Resend(apiKey).emails.send({
    from: resendFrom(),
    to: opts.to,
    subject: `An update on ${opts.projectName}`,
    html,
    text: `${opts.lines.join("\n\n")}\n\nOpen your portal: ${opts.portalUrl}`,
  });
}

// Whether the "a client edited their details" email to Julian is enabled.
// Defaults on; set NOTIFY_CLIENT_EDITS=false to mute it.
export function clientEditNotifyEnabled(): boolean {
  return process.env.NOTIFY_CLIENT_EDITS !== "false";
}
