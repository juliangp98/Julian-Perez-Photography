// What a pipeline email does to its project once it has gone (planned by
// planSendEffects in send-effects.ts): its status, the date hold and the next
// follow-up. Applied when a Compose send goes out, and when the owner notes
// one as sent another way (Already sent on the next step), so both move the
// project the same. Server-only.

import "server-only";
import * as Sentry from "@sentry/nextjs";
import {
  advanceStatus,
  closeProject,
  dismissToday,
  setFollowUp,
  setHold,
  type ClientRecordFull,
} from "@/lib/clients";
import { getAnyService } from "@/lib/content";
import type { ClientStatus } from "@/lib/client-status";
import type { EmailTemplate } from "@/lib/email/email-pipeline";
import { planSendEffects } from "@/lib/email/send-effects";
import { studioToday } from "@/lib/field-format";

// What the send changed on the project, for the caller to confirm, and what
// it meant to change but couldn't.
export type SendMoved = {
  status?: ClientStatus;
  followUpAt?: string;
  followUpNote?: string;
  holdUntil?: string;
};
export type SendNotMoved = "status" | "hold" | "followUp";

// Each step is applied on its own, so a failed one doesn't undo the record of
// the ones that worked. A failure is reported at warning, tagged with the
// caller's route: the email has gone either way. `note` is what the status
// move says in the activity log.
export async function applySendEffects(
  record: ClientRecordFull,
  template: EmailTemplate,
  { note, route }: { note: string; route: string },
): Promise<{ moved: SendMoved; notMoved: SendNotMoved[] }> {
  const moved: SendMoved = {};
  const notMoved: SendNotMoved[] = [];
  const report = (err: unknown, stage: string) =>
    Sentry.captureException(err, { tags: { route, stage }, level: "warning" });
  const step = async (name: SendNotMoved, run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      notMoved.push(name);
      report(err, "advance");
    }
  };

  let plan;
  try {
    const service = record.serviceType ? await getAnyService(record.serviceType) : undefined;
    plan = planSendEffects(template, record, { today: studioToday(), holdDays: service?.holdDays });
  } catch (err) {
    report(err, "advance");
    return { moved, notMoved: ["status", "hold", "followUp"] };
  }

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
  // A follow-up on the proposal once its date hold ran out settles the Today
  // row about that hold, as it settles the project page's step.
  if (template.id === "proposal-follow-up" && record.holdUntil && record.holdUntil <= studioToday()) {
    try {
      await dismissToday(record.id, `hold:${record.holdUntil}`, "handled");
    } catch (err) {
      report(err, "hold-row");
    }
  }
  return { moved, notMoved };
}
