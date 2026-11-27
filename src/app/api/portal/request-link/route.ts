// POST /api/portal/request-link: emails a one-time magic sign-in link. The
// response is identical whatever the input, record, store, or send outcome, so
// it never reveals whether an email has a project; a link goes only to one that does.
// `next` is the portal page the visitor was on, which the link opens after
// signing in (only the projects list or one project's page is kept,
// portalReturnPath).

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { render } from "@react-email/components";
import { defineRoute, originOf } from "@/lib/api-route";
import { isHoneypotTriggered } from "@/lib/request-guard";
import { isAuthConfigured, portalReturnPath, signMagicToken } from "@/lib/auth";
import { emailHasPortalAccess } from "@/lib/clients";
import { sendEmail } from "@/lib/email/send";
import {
  BrandedEmailLayout,
  MagicLinkEmailTemplate,
} from "@/lib/email/email-templates";

const schema = z.object({
  email: z.string().email(),
  hp_company: z.string().max(0).optional().or(z.literal("")),
  next: z.string().max(200).optional(),
});

const UNIFORM = {
  ok: true,
  message: "If that email matches a record, a sign-in link is on its way.",
};

export const POST = defineRoute({
  route: "portal/request-link",
  auth: "public",
  // Parsed inside run so a malformed body still gets the uniform answer.
  schema: z.unknown(),
  rateLimit: { max: 5, windowMs: 10 * 60 * 1000 },
  run: async (body, { req }) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return UNIFORM;
    if (isHoneypotTriggered(parsed.data.hp_company)) return UNIFORM;
    if (!isAuthConfigured()) return UNIFORM;

    const email = parsed.data.email.trim().toLowerCase();

    try {
      // Only issue a link if this email owns or collaborates on a project.
      const hasAccess = await emailHasPortalAccess(email);
      if (!hasAccess) return UNIFORM;

      const token = await signMagicToken({ email, next: portalReturnPath(parsed.data.next) });
      const link = `${originOf(req)}/portal/verify?token=${encodeURIComponent(token)}`;

      // Local dev without Resend: hand the link back so sign-in still works.
      if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
        console.log("[portal] magic link (dev):", link);
        return { ok: true, devLink: link };
      }

      const html = await render(
        BrandedEmailLayout({
          preview: "Your secure sign-in link",
          children: MagicLinkEmailTemplate({ link, kind: "portal" }),
        }),
      );
      await sendEmail({
        to: email,
        subject: "Your sign-in link | Julian Perez Photography",
        html,
        text: `Your secure sign-in link for the Julian Perez Photography client portal:\n\n${link}\n\nThis link expires in 20 minutes and can only be used once. If you didn't request it, ignore this email.`,
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { route: "portal/request-link", stage: "send" } });
    }

    return UNIFORM;
  },
});
