// POST /api/admin/send-email: the owner sends an edited pipeline email to a
// project's client. The recipient comes from the record, never the body; the
// owner gets a copy and the response says whether it left and why not.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { render } from "@react-email/components";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { getSiteSettings } from "@/lib/content";
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

export const POST = defineRoute({
  route: "admin/send-email",
  auth: "admin",
  schema,
  rateLimit: { max: 20, windowMs: 10 * 60 * 1000 },
  run: async ({ projectId, subject, body, idempotencyKey }) => {
    const record = await getClientFull(projectId);
    if (!record) return apiError(404, "That project wasn't found.");
    if (!record.email) return apiError(409, "No email on file for this client.");

    let id: string | null;
    try {
      const settings = await getSiteSettings();
      const html = await render(
        BrandedEmailLayout({
          preview: subject,
          children: PipelineEmailTemplate({ body }),
        }),
      );
      ({ id } = await sendEmail({
        to: record.email,
        replyTo: settings.contactEmail,
        bcc: settings.contactEmail,
        subject,
        html,
        text: body,
        idempotencyKey,
        thread: { projectId, kind: "compose" },
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
      return {
        ok: true,
        sent: false,
        note: "Resend isn't set up here, so the email was logged instead of sent.",
      };
    }

    return { ok: true, sent: true, id };
  },
});
