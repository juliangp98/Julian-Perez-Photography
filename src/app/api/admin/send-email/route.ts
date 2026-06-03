// POST /api/admin/send-email — owner sends a (template-based, edited) email to a
// client from a project. The recipient is resolved server-side from the project
// id (never trusted from the body), the body renders through the shared branded
// layout, and the send is logged to the project's status history.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { getAdminSession } from "@/lib/auth-cookies";
import { getClientFull, addAdminLog } from "@/lib/clients";
import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  PipelineEmailTemplate,
} from "@/lib/email-templates";
import * as Sentry from "@sentry/nextjs";

const schema = z.object({
  projectId: z.string().min(1),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
});

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

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

  // Resolve the recipient from the record — never from the request body.
  const record = await getClientFull(parsed.data.projectId);
  if (!record?.email) {
    return NextResponse.json({ ok: true, sent: false });
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, sent: false });
  }

  try {
    const html = await render(
      BrandedEmailLayout({
        preview: parsed.data.subject,
        children: PipelineEmailTemplate({ body: parsed.data.body }),
      }),
    );
    const from =
      process.env.RESEND_FROM ||
      "Julian Perez Photography <onboarding@resend.dev>";
    await new Resend(apiKey).emails.send({
      from,
      to: record.email,
      subject: parsed.data.subject,
      html,
      text: parsed.data.body,
    });
  } catch (err) {
    console.error("[admin] send-email error:", err);
    Sentry.captureException(err, { tags: { route: "admin-send-email" } });
    return NextResponse.json(
      { error: "Couldn't send — please try again." },
      { status: 500 },
    );
  }

  // Log the send to status history (best-effort).
  try {
    await addAdminLog(parsed.data.projectId, {
      note: `Emailed the client: "${parsed.data.subject}"`,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "admin-send-email", stage: "log" },
      level: "warning",
    });
  }

  return NextResponse.json({ ok: true, sent: true });
}
