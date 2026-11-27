// What sending a pipeline email does to its project: the status it moves to,
// the follow-up it sets, the date hold it starts. Pure, so the send route,
// the Compose panel's tokens and the specs all work from the same rules; the
// route applies the plan once the email has gone.

import { EMAIL_TEMPLATES, type EmailTemplate } from "./email-pipeline";
import {
  CLIENT_STATUS_TERMINAL,
  statusRank,
  type ClientStatus,
} from "../client-status";
import { formatHumanDate, shiftDay } from "../field-format";
import { statusTitle } from "../labels";

// The parts of a project the rules read.
export type SendEffectsProject = {
  status?: string;
  eventDate?: string;
  holdUntil?: string;
  followUpAt?: string;
  followUpNote?: string;
};

// The follow-up the call summary's first save sets.
export const RECAP_FOLLOW_UP_NOTE = "Send the recap and proposal";

// The notes of the follow-ups the pipeline set before a status: the call
// summary's, and those of templates for an earlier stage. A template that
// settles them can tell them from one set by hand, or by a later stage.
function earlierFollowUps(before: ClientStatus): Set<string> {
  const rank = statusRank(before);
  return new Set([
    RECAP_FOLLOW_UP_NOTE,
    ...EMAIL_TEMPLATES.flatMap((t) => {
      const r = statusRank(t.stage);
      return t.followUp && r >= 0 && r < rank ? [t.followUp.note] : [];
    }),
  ]);
}

export type SendEffectsPlan = {
  // Move the project forward to this status.
  advanceTo?: ClientStatus;
  // Close the project with this status (clearing its follow-up and hold).
  closeAs?: ClientStatus;
  // Set the next follow-up.
  followUp?: { at: string; note: string };
  // Clear the follow-up an earlier stage set.
  clearFollowUp?: boolean;
  // Start a date hold running to this day.
  hold?: string;
};

const isClosed = (status?: string) =>
  CLIENT_STATUS_TERMINAL.includes(status as ClientStatus);

// The day a project's date is held until: the hold that's running (today or
// later), or the one a proposal sent today would start (today plus the
// service's hold days). A hold only applies before the date is being reserved,
// so a project at "booked" or later, or a closed one, has none.
export function heldUntil(
  project: SendEffectsProject,
  holdDays: number | undefined,
  today: string,
): { until: string; running: boolean } | undefined {
  if (isClosed(project.status)) return undefined;
  if (statusRank(project.status) >= statusRank("booked")) return undefined;
  if (project.holdUntil && project.holdUntil >= today) {
    return { until: project.holdUntil, running: true };
  }
  if (holdDays && holdDays > 0) {
    return { until: shiftDay(today, { days: holdDays }), running: false };
  }
  return undefined;
}

// The hold an email from `template` names: the one running, or the one sending
// it would start. A template that doesn't hold the date names only a running
// hold.
export function holdUntilFor(
  template: EmailTemplate,
  project: SendEffectsProject,
  { today, holdDays }: { today: string; holdDays?: number },
): string | undefined {
  const running = heldUntil(project, undefined, today);
  return running?.until ?? planSendEffects(template, project, { today, holdDays }).hold;
}

// What sending `template` on `project` today does. `today` is the studio's
// calendar day; `holdDays` the service's hold, when it has one.
export function planSendEffects(
  template: EmailTemplate,
  project: SendEffectsProject,
  { today, holdDays }: { today: string; holdDays?: number },
): SendEffectsPlan {
  const plan: SendEffectsPlan = {};

  // A "no" email closes the project and nothing else follows from it.
  if (template.closesAs) {
    if (project.status !== template.closesAs) plan.closeAs = template.closesAs;
    return plan;
  }

  // Forward only, and a closed project stays closed until reopened by hand.
  if (
    template.advancesTo &&
    !isClosed(project.status) &&
    statusRank(template.advancesTo) > statusRank(project.status)
  ) {
    plan.advanceTo = template.advancesTo;
  }

  // A running hold is left as it is; a new one starts only when the service
  // has hold days.
  if (template.holdsDate) {
    const hold = heldUntil(project, holdDays, today);
    if (hold && !hold.running) plan.hold = hold.until;
  }

  // A follow-up that would land in the past (an anniversary of a long-ago
  // event, say) isn't set.
  const f = template.followUp;
  if (f) {
    const at =
      "days" in f
        ? shiftDay(today, { days: f.days })
        : shiftDay(project.eventDate ?? "", { months: f.monthsAfterEvent });
    if (at && at >= today) plan.followUp = { at, note: f.note };
  }

  if (
    template.settlesFollowUp &&
    template.advancesTo &&
    !plan.followUp &&
    project.followUpAt &&
    earlierFollowUps(template.advancesTo).has(project.followUpNote ?? "")
  ) {
    plan.clearFollowUp = true;
  }

  return plan;
}

// "a, b and c"
export function listOf(parts: string[]): string {
  return parts.length < 2
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

// What sending a template does to one project, in a line (Compose shows it
// before the send), from its plan.
export function planEffectsLine(plan?: SendEffectsPlan): string {
  if (!plan) return "";
  const parts: string[] = [];
  if (plan.closeAs) parts.push(`closes the project as ${statusTitle(plan.closeAs)}`);
  if (plan.advanceTo) parts.push(`moves the project to ${statusTitle(plan.advanceTo)}`);
  if (plan.hold) parts.push(`holds the date until ${formatHumanDate(plan.hold)}`);
  if (plan.followUp) {
    parts.push(`sets a follow-up for ${formatHumanDate(plan.followUp.at)}`);
  }
  if (plan.clearFollowUp) parts.push("clears the follow-up it settles");
  return parts.length ? `Sending this ${listOf(parts)}.` : "";
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// What sending a template does to any project, in a line, by the same rules
// planSendEffects applies to one (the Content page lists every template with
// it): a close and nothing else, else a forward move, a date hold, a
// follow-up, or clearing a follow-up an earlier stage set when it sets none.
export function templateEffectsLine(
  t: Pick<EmailTemplate, "advancesTo" | "closesAs" | "followUp" | "holdsDate" | "settlesFollowUp">,
): string {
  if (t.closesAs) {
    return `Sending this closes the project as ${statusTitle(t.closesAs)} and clears its follow-up and date hold.`;
  }
  const parts: string[] = [];
  if (t.advancesTo) parts.push(`moves the project forward to ${statusTitle(t.advancesTo)}`);
  if (t.holdsDate) parts.push("holds the date for the service's hold days");
  const f = t.followUp;
  if (f) {
    parts.push(
      "days" in f
        ? `sets a follow-up ${plural(f.days, "day")} later (“${f.note}”)`
        : `sets a follow-up for ${plural(f.monthsAfterEvent, "month")} after the event, if that's still ahead (“${f.note}”)`,
    );
  }
  // A send that sets a follow-up replaces the old one instead.
  if (t.settlesFollowUp && t.advancesTo && !f) {
    parts.push("clears a follow-up an earlier stage set (not one you set yourself)");
  }
  return parts.length ? `Sending this ${listOf(parts)}.` : "Sending this leaves the project as it is.";
}

// What applying a send meant to change but couldn't, in a line after `lead`
// ("The email went", "Noted"), for Compose and Already sent alike.
const NOT_MOVED: Record<string, string> = {
  status: "the status",
  hold: "the date hold",
  followUp: "the follow-up",
};
export function notMovedLine(lead: string, notMoved?: string[]): string {
  if (!notMoved?.length) return "";
  const what = listOf(notMoved.map((n) => NOT_MOVED[n] ?? n));
  return `${lead}, but ${what} couldn't be updated.${
    notMoved.includes("status") ? " Set the status at the top of the page." : ""
  }`;
}
