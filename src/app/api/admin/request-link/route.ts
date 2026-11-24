// POST /api/admin/request-link — emails the owner a one-time admin sign-in
// link. Only the configured ADMIN_EMAIL(s) ever receive a link; the response is
// uniform regardless, so the endpoint reveals nothing.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";
import { sendEmail } from "@/lib/email/send";
import {
  isAdminConfigured,
  isAdminEmail,
  signAdminMagicToken,
} from "@/lib/auth";
import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  MagicLinkEmailTemplate,
} from "@/lib/email/email-templates";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  email: z.string().email(),
  hp_company: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, {
    key: "admin-link",
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

  const uniform = NextResponse.json({
    ok: true,
    message: "If that email is authorized, a sign-in link is on its way.",
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return uniform;
  if (isHoneypotTriggered(parsed.data.hp_company)) return uniform;
  if (!isAdminConfigured()) return uniform;

  const email = parsed.data.email.trim().toLowerCase();
  if (!isAdminEmail(email)) return uniform;

  try {
    const token = await signAdminMagicToken(email);
    const origin = req.headers.get("origin") || new URL(req.url).origin;
    const link = `${origin}/admin/verify?token=${encodeURIComponent(token)}`;

    // Local dev without Resend: hand the link back so sign-in still works.
    if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
      console.log("[admin] magic link (dev):", link);
      return NextResponse.json({ ok: true, devLink: link });
    }

    const html = await render(
      BrandedEmailLayout({
        preview: "Your admin sign-in link",
        children: MagicLinkEmailTemplate({ link, kind: "admin" }),
      }),
    );
    await sendEmail({
      to: email,
      subject: "Admin sign-in link — Julian Perez Photography",
      html,
      text: `Your admin sign-in link:\n\n${link}\n\nExpires in 20 minutes. If you didn't request it, ignore this email.`,
    });
  } catch (err) {
    console.error("[admin] request-link error:", err);
    Sentry.captureException(err, { tags: { route: "admin-request-link" } });
  }

  return uniform;
}
