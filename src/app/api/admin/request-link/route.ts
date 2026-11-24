// POST /api/admin/request-link: emails the owner a one-time admin sign-in link.
// Only the configured ADMIN_EMAIL(s) ever receive one, and the response is the
// same for any input, including a failed send, so the endpoint reveals nothing.

export const runtime = "nodejs";

import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { render } from "@react-email/components";
import { defineRoute, originOf } from "@/lib/api-route";
import { isHoneypotTriggered } from "@/lib/request-guard";
import { sendEmail } from "@/lib/email/send";
import {
  isAdminConfigured,
  isAdminEmail,
  signAdminMagicToken,
} from "@/lib/auth";
import {
  BrandedEmailLayout,
  MagicLinkEmailTemplate,
} from "@/lib/email/email-templates";

const schema = z.object({
  email: z.string().email(),
  hp_company: z.string().max(0).optional().or(z.literal("")),
});

const UNIFORM = {
  ok: true,
  message: "If that email is authorized, a sign-in link is on its way.",
};

export const POST = defineRoute({
  route: "admin/request-link",
  auth: "public",
  // Parsed inside run so a malformed body still gets the uniform answer.
  schema: z.unknown(),
  rateLimit: { max: 5, windowMs: 10 * 60 * 1000 },
  run: async (body, { req }) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return UNIFORM;
    if (isHoneypotTriggered(parsed.data.hp_company)) return UNIFORM;
    if (!isAdminConfigured()) return UNIFORM;

    const email = parsed.data.email.trim().toLowerCase();
    if (!isAdminEmail(email)) return UNIFORM;

    try {
      const token = await signAdminMagicToken(email);
      const link = `${originOf(req)}/admin/verify?token=${encodeURIComponent(token)}`;

      // Local dev without Resend: hand the link back so sign-in still works.
      if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
        console.log("[admin] magic link (dev):", link);
        return { ok: true, devLink: link };
      }

      const html = await render(
        BrandedEmailLayout({
          preview: "Your admin sign-in link",
          children: MagicLinkEmailTemplate({ link, kind: "admin" }),
        }),
      );
      await sendEmail({
        to: email,
        subject: "Admin sign-in link | Julian Perez Photography",
        html,
        text: `Your admin sign-in link:\n\n${link}\n\nExpires in 20 minutes. If you didn't request it, ignore this email.`,
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { route: "admin/request-link", stage: "send" } });
    }

    return UNIFORM;
  },
});
