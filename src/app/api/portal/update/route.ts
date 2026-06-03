// POST /api/portal/update — client-portal field edits.
//
// Authenticated by the session cookie; the record id comes ONLY from the
// verified session (never the request body), so a client can only ever edit
// their own record. The zod schema is the whitelist — status, package,
// pricing, and internal fields are not editable here.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { rateLimitResponse } from "@/lib/request-guard";
import { getSession } from "@/lib/auth-cookies";
import { updateClientFields, getProjectForEmail } from "@/lib/clients";
import { getSiteSettings } from "@/lib/content";
import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  NotificationEmailTemplate,
} from "@/lib/email-templates";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
  phone: z.string().max(50).optional(),
  partnerName: z.string().max(200).optional(),
  guestCount: z.coerce.number().int().min(0).max(100000).optional(),
  planSummary: z.string().max(5000).optional(),
  projectName: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const limited = rateLimitResponse(req, {
    key: "portal-update",
    max: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

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

  const { projectId, ...fields } = parsed.data;
  // Ownership gate — the project must belong to the signed-in person.
  const owned = await getProjectForEmail(projectId, session.email);
  if (!owned) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    await updateClientFields(projectId, fields);
  } catch (err) {
    console.error("[portal] update error:", err);
    Sentry.captureException(err, {
      tags: { route: "portal-update", stage: "write" },
    });
    return NextResponse.json(
      { error: "Couldn't save right now — please try again." },
      { status: 500 },
    );
  }

  // Notify Julian (fire-and-forget) so he knows to review the change.
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const settings = await getSiteSettings();
      const to = process.env.INQUIRY_TO || settings.contactEmail;
      const from =
        process.env.RESEND_FROM ||
        "Julian Perez Photography <onboarding@resend.dev>";
      const origin = req.headers.get("origin") || new URL(req.url).origin;
      const html = await render(
        BrandedEmailLayout({
          preview: "A client updated their portal details",
          children: NotificationEmailTemplate({
            heading: "Client details updated",
            lines: [
              `${session.email} just updated their details in the client portal.`,
              "Open the admin dashboard to review the change.",
            ],
            cta: { label: "Open admin →", href: `${origin}/admin/projects` },
          }),
        }),
      );
      await new Resend(apiKey).emails.send({
        from,
        to,
        subject: `Client updated their details — ${session.email}`,
        html,
        text: `${session.email} updated their portal details. Review it in your admin dashboard: ${origin}/admin/projects`,
      });
    }
  } catch (err) {
    console.error("[portal] update notify error:", err);
    Sentry.captureException(err, {
      tags: { route: "portal-update", stage: "notify" },
      level: "warning",
    });
  }

  return NextResponse.json({ ok: true });
}
