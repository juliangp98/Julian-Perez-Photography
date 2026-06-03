// POST /api/portal/request-link — emails a one-time magic sign-in link.
//
// Anti-enumeration: the response is identical whether or not the email maps to
// a record, whether the input is valid, or whether the store is configured.
// A link is only actually sent when a matching record exists.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { rateLimitResponse, isHoneypotTriggered } from "@/lib/request-guard";
import { isAuthConfigured, signMagicToken } from "@/lib/auth";
import { findClientIdByEmail } from "@/lib/clients";
import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  MagicLinkEmailTemplate,
} from "@/lib/email-templates";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  email: z.string().email(),
  hp_company: z.string().max(0).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, {
    key: "portal-link",
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

  // One uniform success response, no matter what — never reveal whether an
  // email maps to a record.
  const uniform = NextResponse.json({
    ok: true,
    message: "If that email matches a record, a sign-in link is on its way.",
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return uniform;
  if (isHoneypotTriggered(parsed.data.hp_company)) return uniform;
  if (!isAuthConfigured()) return uniform;

  const email = parsed.data.email.trim().toLowerCase();

  try {
    // Only issue a link if this email has at least one project.
    const recordId = await findClientIdByEmail(email);
    if (!recordId) return uniform;

    const token = await signMagicToken({ email });
    const origin = req.headers.get("origin") || new URL(req.url).origin;
    const link = `${origin}/portal/verify?token=${encodeURIComponent(token)}`;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Dev fallback — surface the link so local dev / e2e complete the loop
      // without a mail provider. Never active in production.
      console.log("[portal] magic link (dev):", link);
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ ok: true, devLink: link });
      }
      return uniform;
    }

    const resend = new Resend(apiKey);
    const from =
      process.env.RESEND_FROM ||
      "Julian Perez Photography <onboarding@resend.dev>";
    const html = await render(
      BrandedEmailLayout({
        preview: "Your secure sign-in link",
        children: MagicLinkEmailTemplate({ link, kind: "portal" }),
      }),
    );
    await resend.emails.send({
      from,
      to: email,
      subject: "Your sign-in link — Julian Perez Photography",
      html,
      text: `Your secure sign-in link for the Julian Perez Photography client portal:\n\n${link}\n\nThis link expires in 20 minutes and can only be used once. If you didn't request it, ignore this email.`,
    });
  } catch (err) {
    console.error("[portal] request-link error:", err);
    Sentry.captureException(err, { tags: { route: "portal-request-link" } });
    // Still return uniform — never leak a failure or the record's existence.
  }

  return uniform;
}
