// POST /api/admin/send-email: the owner sends an edited pipeline email to a
// project's client. The recipient comes from the record, never the body; the
// owner gets a copy and the response says whether it left and why not. Once it
// has gone, the template it started from moves the project on: its status,
// its next follow-up, the date hold (src/lib/email/send-effects.ts). The
// response says what moved.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { render } from "@react-email/components";
import * as Sentry from "@sentry/nextjs";
import { apiError, defineRoute } from "@/lib/api-route";
import {
  advanceStatus,
  closeProject,
  getClientFull,
  setFollowUp,
  setHold,
  type ClientRecordFull,
} from "@/lib/clients";
import { getAnyService, getSiteSettings } from "@/lib/content";
import { EMAIL_TEMPLATES, type EmailTemplate } from "@/lib/email/email-pipeline";
import { planSendEffects } from "@/lib/email/send-effects";
import { studioToday } from "@/lib/field-format";
import type { ClientStatus } from "@/lib/client-status";
import { sendEmail, EmailError, describeEmailFailure } from "@/lib/email/send";
import {
  BrandedEmailLayout,
  PipelineEmailTemplate,
} from "@/lib/email/email-templates";

const TEMPLATE_IDS = EMAIL_TEMPLATES.map((t) => t.id) as [string, ...string[]];

// What the send changed on the project, for the panel to confirm, and what it
// meant to change but couldn't.
type Moved = {
  status?: ClientStatus;
  followUpAt?: string;
  followUpNote?: string;
  holdUntil?: string;
};
type NotMoved = "status" | "hold" | "followUp";

// Apply what the template does, one step at a time, so a failed step doesn't
// undo the record of the ones that worked. A failure is reported at warning:
// the email has already gone.
async function applyTemplate(
  record: ClientRecordFull,
  template: EmailTemplate,
): Promise<{ moved: Moved; notMoved: NotMoved[] }> {
  const moved: Moved = {};
  const notMoved: NotMoved[] = [];
  const step = async (name: NotMoved, run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      notMoved.push(name);
      Sentry.captureException(err, {
        tags: { route: "admin/send-email", stage: "advance" },
        level: "warning",
      });
    }
  };

  let plan;
  try {
    const service = record.serviceType ? await getAnyService(record.serviceType) : undefined;
    plan = planSendEffects(template, record, { today: studioToday(), holdDays: service?.holdDays });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "admin/send-email", stage: "advance" },
      level: "warning",
    });
    return { moved, notMoved: ["status", "hold", "followUp"] };
  }

  const note = `${template.name} sent`;
  const { closeAs, advanceTo, hold, followUp } = plan;
  if (closeAs) {
    await step("status", async () => {
      if (await closeProject(record.id, closeAs, note)) moved.status = closeAs;
    });
  }
  if (advanceTo) {
    await step("status", async () => {
      if (await advanceStatus(record.id, advanceTo, note)) moved.status = advanceTo;
    });
  }
  if (hold) {
    await step("hold", async () => {
      await setHold(record.id, hold);
      moved.holdUntil = hold;
    });
  }
  if (followUp) {
    await step("followUp", async () => {
      await setFollowUp(record.id, followUp.at, followUp.note);
      moved.followUpAt = followUp.at;
      moved.followUpNote = followUp.note;
    });
  }
  return { moved, notMoved };
}

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

    // The email has gone either way; a project that couldn't be updated is
    // reported, not surfaced as a failed send.
    const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return { ok: true, sent: true, id };
    const { moved, notMoved } = await applyTemplate(record, template);
    return { ok: true, sent: true, id, moved, ...(notMoved.length ? { notMoved } : {}) };
  },
});
