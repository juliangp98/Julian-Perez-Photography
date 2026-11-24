// POST /api/admin/send-email: the owner sends an edited pipeline email to a
// project's client. The recipient comes from the record, never the body. The
// response says plainly whether the email left, and why not when it didn't.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { render } from "@react-email/components";
import * as Sentry from "@sentry/nextjs";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull, addAdminLog } from "@/lib/clients";
import { getSiteSettings } from "@/lib/content";
import { rateLimitResponse } from "@/lib/request-guard";
import { sendEmail, EmailError, describeEmailFailure } from "@/lib/email/send";
import {
  BrandedEmailLayout,
  PipelineEmailTemplate,
} from "@/lib/email/email-templates";

const schema = z.object({
  projectId: z.string().min(1),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  // One per composed message, so a retried or double-clicked send goes once.
  idempotencyKey: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const limited = rateLimitResponse(req, {
    key: "admin-send-email",
    max: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { projectId, subject, idempotencyKey } = parsed.data;

  const record = await getClientFull(projectId);
  if (!record) {
    return NextResponse.json({ error: "That project wasn't found." }, { status: 404 });
  }
  if (!record.email) {
    return NextResponse.json({ error: "No email on file for this client." }, { status: 409 });
  }

  let id: string | null;
  try {
    const settings = await getSiteSettings();
    const html = await render(
      BrandedEmailLayout({
        preview: subject,
        children: PipelineEmailTemplate({ body: parsed.data.body }),
      }),
    );
    ({ id } = await sendEmail({
      to: record.email,
      replyTo: settings.contactEmail,
      subject,
      html,
      text: parsed.data.body,
      idempotencyKey,
    }));
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "admin/send-email", stage: "send" } });
    const status =
      err instanceof EmailError ? (err.reason === "not-configured" ? 503 : 502) : 500;
    return NextResponse.json(
      { error: `Not sent: ${describeEmailFailure(err)}.` },
      { status },
    );
  }

  if (!id) {
    return NextResponse.json({
      ok: true,
      sent: false,
      note: "Resend isn't set up here, so the email was logged instead of sent.",
    });
  }

  // Best-effort record on the project history, with Resend's id as proof.
  try {
    await addAdminLog(projectId, {
      note: `Emailed the client: "${subject}" (Resend ${id})`,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "admin/send-email", stage: "log" },
      level: "warning",
    });
  }

  return NextResponse.json({ ok: true, sent: true, id });
}
