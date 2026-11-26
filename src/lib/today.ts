// The Today list on the projects board: what needs the owner now, worked out
// from the projects with rules, not AI. Each row says why it's there and
// offers one thing to do. Rows can be marked handled or snoozed; a row's key
// names the rule and what set it off, so the same rule firing for something
// new (a later message, a new hold, an invoice gone overdue) shows again.
// Pure, so the board and the specs share it.

import { CLIENT_STATUS_TERMINAL, statusRank, type ClientStatus } from "./client-status";
import { dayAgo, daysBetween, eventDay, formatHumanDate, shiftDay, studioDayOf } from "./field-format";
import { draftReplyHref } from "./triage";

// The parts of a project the rules read.
export type TodayProject = {
  id: string;
  name: string;
  clientName?: string;
  status?: string;
  serviceType?: string;
  eventDate?: string;
  followUpAt?: string;
  followUpNote?: string;
  holdUntil?: string;
  questionnaireSnapshot?: string;
  documents?: { id?: string; type?: string; label?: string; dueAt?: string; paidAt?: string }[];
  lastInAt?: string;
  lastOutAt?: string;
  todayDismissed?: Record<string, string>;
  // When the project was created: an inquiry's arrival.
  createdAt?: string;
  // Its moves, for when a lost lead was closed.
  statusHistory?: { status?: string; changedAt?: string; kind?: string }[];
};

export type TodayRule =
  | "follow-up"
  | "reply"
  | "inquiry"
  | "hold"
  | "invoice"
  | "questionnaire"
  | "editing";

export type TodayRow = {
  projectId: string;
  projectName: string;
  rule: TodayRule;
  // Unique per project: what Mark handled and Snooze are saved under.
  key: string;
  // Why it's here, in a few words.
  reason: string;
  // When it fell due, for sorting: a calendar day.
  due: string;
  // The one thing to do.
  action: { label: string; href: string };
};

// What the rules need to know about each service.
export type TodayServiceTerms = {
  // Days from the shoot to the delivered gallery.
  turnaroundDays?: number;
  // Whether the service has a planning questionnaire.
  questionnaire: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isClosed = (status?: string) => CLIENT_STATUS_TERMINAL.includes(status as ClientStatus);
// The studio's calendar day of a stored timestamp, so an evening message
// counts on the day it was sent there.
const dayOf = (iso?: string) => (iso ? studioDayOf(iso) : "");

// The rows for one project, before dismissals.
function rowsFor(
  p: TodayProject,
  today: string,
  terms: TodayServiceTerms | undefined,
): TodayRow[] {
  const rows: TodayRow[] = [];
  const page = `/admin/projects/${p.id}`;
  const compose = (template: string) => `${page}?compose=${template}#compose`;
  const add = (rule: TodayRule, key: string, reason: string, due: string, action: TodayRow["action"]) =>
    rows.push({ projectId: p.id, projectName: p.name, rule, key, reason, due, action });
  const rank = statusRank(p.status);
  const closed = isClosed(p.status);
  const first = p.clientName?.trim().split(/\s+/)[0] || "The client";

  // A follow-up that's due, on any project (a closed lead's last check-in too).
  if (p.followUpAt && DAY.test(p.followUpAt) && p.followUpAt <= today) {
    const when = p.followUpAt === today ? "due today" : `due ${formatHumanDate(p.followUpAt)}`;
    add(
      "follow-up",
      `follow-up:${p.followUpAt}`,
      `${p.followUpNote || "Follow up"} (${when})`,
      p.followUpAt,
      { label: "Open", href: page },
    );
  }
  // A closed project has nothing more to do, except a lost lead writing back
  // after it was closed: the check-in worked.
  if (closed && p.status !== "lost") return rows;

  // The client wrote last, and hasn't had an answer. A new inquiry nothing
  // has gone to yet gets the inquiry reply; otherwise Compose opens on no
  // template, as the project page's next step does.
  const closedAt = closed ? lostAt(p.statusHistory) : undefined;
  const replied =
    !!p.lastInAt &&
    (!p.lastOutAt || p.lastInAt > p.lastOutAt) &&
    (!closedAt || Date.parse(p.lastInAt) > Date.parse(closedAt));
  if (replied) {
    const day = dayOf(p.lastInAt);
    const lead = (!p.status || p.status === "new-inquiry") && !p.lastOutAt;
    add("reply", replyKey(p.lastInAt ?? ""), `${first} wrote ${dayAgo(day, today)}, not answered yet`, day, {
      label: "Reply",
      href: lead ? draftReplyHref(page) : `${page}?tab=messages#compose`,
    });
  }
  if (closed) return rows;

  // A new inquiry nobody has answered, at any age: due from the day it came.
  if (p.status === "new-inquiry" && !p.lastOutAt && !replied) {
    const since = dayOf(p.createdAt) || today;
    add("inquiry", "inquiry", `New inquiry ${dayAgo(since, today)}, not answered yet`, since, {
      label: "Draft a reply",
      href: draftReplyHref(page),
    });
  }

  // A date hold that ran out before they booked.
  if (p.holdUntil && DAY.test(p.holdUntil) && p.holdUntil < today && rank < statusRank("booked")) {
    add(
      "hold",
      `hold:${p.holdUntil}`,
      `Date hold ended ${formatHumanDate(p.holdUntil)}, not booked`,
      p.holdUntil,
      { label: "Follow up", href: compose("proposal-follow-up") },
    );
  }

  // Unpaid invoices due within a week, or overdue. Going overdue is a new
  // row, so one handled while it was coming due still shows once it's late.
  const week = shiftDay(today, { days: 7 });
  for (const doc of p.documents ?? []) {
    if (doc.type !== "invoice" || doc.paidAt || !doc.dueAt || !DAY.test(doc.dueAt) || doc.dueAt > week) continue;
    const label = doc.label || "Invoice";
    const overdue = doc.dueAt < today;
    add(
      "invoice",
      `invoice:${doc.id ?? label}:${doc.dueAt}:${overdue ? "overdue" : "due"}`,
      overdue
        ? `${label} overdue since ${formatHumanDate(doc.dueAt)}`
        : `${label} due ${doc.dueAt === today ? "today" : formatHumanDate(doc.dueAt)}`,
      doc.dueAt,
      { label: "Send a reminder", href: compose("payment-reminder") },
    );
  }

  // A booked shoot two weeks out with no questionnaire back.
  const shoot = eventDay(p.eventDate);
  if (
    terms?.questionnaire &&
    shoot &&
    rank >= statusRank("booked") &&
    rank < statusRank("shot") &&
    !p.questionnaireSnapshot?.trim()
  ) {
    const days = daysBetween(today, shoot);
    if (days >= 0 && days <= 14) {
      add(
        "questionnaire",
        `questionnaire:${shoot}`,
        `Shoot ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}, no questionnaire yet`,
        shoot,
        { label: "Send a reminder", href: compose("questionnaire-reminder") },
      );
    }
  }

  // Still editing past the service's turnaround.
  if (terms?.turnaroundDays && shoot && (p.status === "shot" || p.status === "editing")) {
    const dueDay = shiftDay(shoot, { days: terms.turnaroundDays });
    if (dueDay < today) {
      add(
        "editing",
        `editing:${shoot}`,
        `Gallery was due ${formatHumanDate(dueDay)} (${terms.turnaroundDays}-day turnaround)`,
        dueDay,
        { label: "Open", href: page },
      );
    }
  }
  return rows;
}

// Whether a row's mark hides it: marked handled, or snoozed until a day after
// today. The project page's next step reads the same marks.
export function hiddenByMark(mark: string | undefined, today: string): boolean {
  if (!mark) return false;
  return mark === "handled" || (DAY.test(mark) && mark > today);
}

// The key of the row for a client's message that hasn't had an answer.
export const replyKey = (lastInAt: string) => `reply:${lastInAt}`;

// When a lead was last closed as lost: a message from before then had its
// answer in the closing.
export function lostAt(history?: { status?: string; changedAt?: string; kind?: string }[]): string | undefined {
  // A note added since carries the status too, but isn't the close.
  return [...(history ?? [])].reverse().find((h) => h.status === "lost" && h.kind !== "note")?.changedAt;
}

function dismissed(row: TodayRow, p: TodayProject, today: string): boolean {
  return hiddenByMark(p.todayDismissed?.[row.key], today);
}

// Today's rows across projects, by the day each fell due: the
// longest-waiting first.
export function todayRows(
  projects: TodayProject[],
  today: string,
  terms: (serviceType?: string) => TodayServiceTerms | undefined,
): TodayRow[] {
  return projects
    .flatMap((p) => rowsFor(p, today, terms(p.serviceType)).filter((r) => !dismissed(r, p, today)))
    .sort((a, b) => a.due.localeCompare(b.due) || a.projectName.localeCompare(b.projectName));
}
