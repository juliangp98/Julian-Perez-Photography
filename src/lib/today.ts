// The Today list on the projects board: what needs the owner now, worked out
// from the projects with rules, not AI. Each row says why it's there and
// offers one thing to do. Rows can be marked handled or snoozed; a row's key
// names the rule and what set it off, so the same rule firing for something
// new (a later message, a new hold) shows again. Pure, so the board, the
// morning email and the specs share it.

import { CLIENT_STATUS_TERMINAL, statusRank, type ClientStatus } from "./client-status";
import { formatHumanDate, shiftDay } from "./field-format";
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
// The calendar day of a stored timestamp, in UTC: close enough for "days ago".
const dayOf = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

function ago(day: string, today: string): string {
  const d = daysBetween(day, today);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

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
  if (closed) return rows;

  // The client wrote last, and hasn't had an answer.
  const replied = !!p.lastInAt && (!p.lastOutAt || p.lastInAt > p.lastOutAt);
  if (replied) {
    const day = dayOf(p.lastInAt);
    add("reply", `reply:${p.lastInAt}`, `${first} wrote ${ago(day, today)}, not answered yet`, day, {
      label: "Reply",
      href: compose("inquiry-reply"),
    });
  }

  // A new inquiry nobody has answered, at any age.
  if (p.status === "new-inquiry" && !p.lastOutAt && !replied) {
    add("inquiry", "inquiry", "New inquiry, not answered yet", today, {
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

  // Unpaid invoices due within a week, or overdue.
  const week = shiftDay(today, { days: 7 });
  for (const doc of p.documents ?? []) {
    if (doc.type !== "invoice" || doc.paidAt || !doc.dueAt || !DAY.test(doc.dueAt) || doc.dueAt > week) continue;
    const label = doc.label || "Invoice";
    add(
      "invoice",
      `invoice:${doc.id ?? label}:${doc.dueAt}`,
      doc.dueAt < today
        ? `${label} overdue since ${formatHumanDate(doc.dueAt)}`
        : `${label} due ${doc.dueAt === today ? "today" : formatHumanDate(doc.dueAt)}`,
      doc.dueAt,
      { label: "Send a reminder", href: compose("payment-reminder") },
    );
  }

  // A booked shoot two weeks out with no questionnaire back.
  if (
    terms?.questionnaire &&
    p.eventDate &&
    DAY.test(p.eventDate) &&
    rank >= statusRank("booked") &&
    rank < statusRank("shot") &&
    !p.questionnaireSnapshot?.trim()
  ) {
    const days = daysBetween(today, p.eventDate);
    if (days >= 0 && days <= 14) {
      add(
        "questionnaire",
        `questionnaire:${p.eventDate}`,
        `Shoot ${days === 0 ? "today" : `in ${days} days`}, no questionnaire yet`,
        p.eventDate,
        { label: "Send a reminder", href: compose("questionnaire-reminder") },
      );
    }
  }

  // Still editing past the service's turnaround.
  if (
    terms?.turnaroundDays &&
    p.eventDate &&
    DAY.test(p.eventDate) &&
    (p.status === "shot" || p.status === "editing")
  ) {
    const dueDay = shiftDay(p.eventDate, { days: terms.turnaroundDays });
    if (dueDay < today) {
      add(
        "editing",
        `editing:${p.eventDate}`,
        `Gallery was due ${formatHumanDate(dueDay)} (${terms.turnaroundDays}-day turnaround)`,
        dueDay,
        { label: "Open", href: page },
      );
    }
  }
  return rows;
}

// Whether a row is hidden: marked handled, or snoozed until a day after today.
function dismissed(row: TodayRow, p: TodayProject, today: string): boolean {
  const mark = p.todayDismissed?.[row.key];
  if (!mark) return false;
  return mark === "handled" || (DAY.test(mark) && mark > today);
}

// Today's rows across projects, the longest-waiting first.
export function todayRows(
  projects: TodayProject[],
  today: string,
  terms: (serviceType?: string) => TodayServiceTerms | undefined,
): TodayRow[] {
  return projects
    .flatMap((p) => rowsFor(p, today, terms(p.serviceType)).filter((r) => !dismissed(r, p, today)))
    .sort((a, b) => a.due.localeCompare(b.due) || a.projectName.localeCompare(b.projectName));
}
