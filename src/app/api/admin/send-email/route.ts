// POST /api/admin/send-email: the owner sends an edited pipeline email to a
// project's client. The recipient comes from the record, never the body; the
// owner gets a copy and the response says whether it left and why not. Once it
// has gone, the template it started from moves the project on: its status,
// its next follow-up, the date hold (applySendEffects in
// src/lib/email/apply-send.ts). The response says what moved.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { render } from "@react-email/components";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import { getClientFull } from "@/lib/clients";
import { getSiteSettings } from "@/lib/content";
import { EMAIL_TEMPLATES, unfilledParts } from "@/lib/email/email-pipeline";
import { applySendEffects } from "@/lib/email/apply-send";
import { sendEmail, EmailError, describeEmailFailure } from "@/lib/email/send";
import {
  BrandedEmailLayout,
  PipelineEmailTemplate,
} from "@/lib/email/email-templates";

const TEMPLATE_IDS = EMAIL_TEMPLATES.map((t) => t.id) as [string, ...string[]];

const schema = z.object({
  projectId: z.string().min(1),
  // The template the email started from, when there was one. Sending applies
  // what that template does to the project.
  templateId: z.enum(TEMPLATE_IDS).optional(),
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
  run: async ({ projectId, templateId, subject, body, idempotencyKey }) => {
    // Nothing goes out with brackets left to fill (Compose checks too; this
    // catches a page left open on an older version).
    const unfilled = unfilledParts(`${subject}\n${body}`);
    if (unfilled.length) return apiError(422, `Fill these in first: ${unfilled.join(", ")}.`);
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
        thread: { projectId, kind: "compose", template: templateId },
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

    // The email has gone either way; a project that couldn't be updated is
    // reported, not surfaced as a failed send.
    const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return { ok: true, sent: true, id };
    const { moved, notMoved } = await applySendEffects(record, template, {
      note: `${template.name} sent`,
      route: "admin/send-email",
    });
    return { ok: true, sent: true, id, moved, ...(notMoved.length ? { notMoved } : {}) };
  },
});
