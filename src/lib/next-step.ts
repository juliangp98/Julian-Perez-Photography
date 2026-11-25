// The one next step on a project, for the owner: worked out from where the
// project stands with rules, not AI, and shown at the top of the project page
// with one button. A step that waits on the client says so, and its button is
// the thing to do meanwhile (or none). Pure, so the page and the specs share it.

import { CLIENT_STATUS_TERMINAL, type ClientStatus } from "./client-status";
import { EMAIL_TEMPLATES } from "./email/email-pipeline";
import { dayAgo, daysBetween, eventDay, formatHumanDate, shiftDay, studioDayOf } from "./field-format";
import { openInvoice } from "./project-links";
import { hiddenByMark, replyKey } from "./today";
import { draftReplyHref } from "./triage";

export type NextStep = {
  // What to do, or what it's waiting on.
  title: string;
  // Why, or what comes after, in a sentence.
  detail?: string;
  action?: { label: string; href: string };
};

// The parts of a project the rules read.
export type NextStepProject = {
  id: string;
  status?: string;
  clientName?: string;
  email?: string;
  eventDate?: string;
  holdUntil?: string;
  followUpAt?: string;
  questionnaireSnapshot?: string;
  documents?: { type?: string; uploadedBy?: string; dueAt?: string; paidAt?: string }[];
  calls?: { discovery?: { heldAt?: string; notes?: string; answers?: Record<string, string> } };
  // When each side last wrote (the conversation only, as the board counts it).
  lastInAt?: string;
  lastOutAt?: string;
  // The Today rows marked handled or snoozed (src/lib/today.ts): a client's
  // message marked handled there needs no answer here either.
  todayDismissed?: Record<string, string>;
};

export type NextStepContext = {
  // The studio's calendar day.
  today: string;
  // The templates already sent on this project.
  sent: ReadonlySet<string>;
  // Whether the service has a planning questionnaire.
  questionnaire: boolean;
  // Days from the shoot to the delivered gallery, when the service says.
  turnaroundDays?: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// How far ahead of the shoot planning starts: the booking welcome tells the
// client the questionnaire comes closer to the date.
const PLANNING_WINDOW_DAYS = 60;

// A template's subject as a pattern, its {{tokens}} standing for any text.
const SUBJECT_PATTERNS = EMAIL_TEMPLATES.map((t) => ({
  id: t.id,
  pattern: new RegExp(
    `^${t.subject
      .split(/\{\{\w+\}\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".+?")}$`,
    "i",
  ),
}));

// The templates already sent on a project, from its outgoing emails: each
// records the template it started from, and counts once it went out (a
// bounced or failed one doesn't). An email sent before that was recorded
// counts when its subject still reads as a template's, or when the activity
// log notes the send ("<template name> sent", written when it moved the
// project) and no recorded email carries that template, so a step done before
// then isn't offered again.
export function sentTemplates(
  messages: { direction: string; template?: string; subject?: string; wentOut: boolean }[],
  history: { note?: string }[] = [],
): Set<string> {
  const sent = new Set<string>();
  const recorded = new Set<string>();
  for (const m of messages) {
    if (m.direction !== "out") continue;
    if (m.template) {
      recorded.add(m.template);
      if (m.wentOut) sent.add(m.template);
      continue;
    }
    if (!m.wentOut) continue;
    const subject = m.subject?.trim() ?? "";
    for (const t of SUBJECT_PATTERNS) if (subject && t.pattern.test(subject)) sent.add(t.id);
  }
  for (const h of history) {
    const t = EMAIL_TEMPLATES.find((x) => h.note === `${x.name} sent`);
    if (t && !recorded.has(t.id)) sent.add(t.id);
  }
  return sent;
}

export function ownerNextStep(p: NextStepProject, ctx: NextStepContext): NextStep {
  const page = `/admin/projects/${p.id}`;
  const compose = (template: string) => `${page}?compose=${template}#compose`;
  const tab = (name: string) => `${page}?tab=${name}`;
  const first = p.clientName?.trim().split(/\s+/)[0] || "the client";
  const First = first.charAt(0).toUpperCase() + first.slice(1);
  const { today, sent } = ctx;
  const status = p.status as ClientStatus | undefined;

  // A kind Julian adds, his own entry (a client can't stand in for it).
  const docs = p.documents ?? [];
  const has = (type: string) => docs.some((d) => d.type === type && d.uploadedBy !== "client");
  const invoices = docs.filter((d) => d.type === "invoice" && d.uploadedBy !== "client");
  const unpaid = invoices.filter((d) => !d.paidAt);
  // The invoice the client pays next (the one a reminder names), and how it
  // stands.
  const nextDue = openInvoice(p);
  const dueLine =
    nextDue?.dueAt && DAY.test(nextDue.dueAt)
      ? nextDue.dueAt < today
        ? `It was due ${formatHumanDate(nextDue.dueAt)}.`
        : `It's due ${nextDue.dueAt === today ? "today" : formatHumanDate(nextDue.dueAt)}.`
      : undefined;
  const overdue = !!nextDue?.dueAt && DAY.test(nextDue.dueAt) && nextDue.dueAt < today;

  if (CLIENT_STATUS_TERMINAL.includes(status as ClientStatus)) {
    if (status === "lost") {
      return {
        title: "Closed as lost",
        detail: "If the date is still open, a check-in can bring them back.",
        action: { label: "Write a check-in", href: compose("re-engagement") },
      };
    }
    return { title: "Closed", detail: "Nothing left to do. Change the status to reopen it." };
  }

  if (!p.email?.trim()) {
    return {
      title: "Add the client's email",
      detail: "Emails and the portal both need it.",
      action: { label: "Open details", href: tab("details") },
    };
  }

  // The client wrote last and hasn't had an answer, whatever the stage, unless
  // their message was marked handled (or snoozed) on the Today list. A new
  // inquiry's answer is the inquiry reply.
  if (
    p.lastInAt &&
    (!p.lastOutAt || p.lastInAt > p.lastOutAt) &&
    !hiddenByMark(p.todayDismissed?.[replyKey(p.lastInAt)], today)
  ) {
    const lead = !status || status === "new-inquiry";
    return {
      title: `Answer ${first}`,
      detail: `${First} wrote ${dayAgo(studioDayOf(p.lastInAt), today)}.`,
      action: lead
        ? { label: "Draft a reply", href: draftReplyHref(page) }
        : { label: "Write a reply", href: `${page}?tab=messages#compose` },
    };
  }

  const call = p.calls?.discovery;
  // Held means the summary was saved after a call; a project moved to In
  // conversation by hand had no call.
  const callHeld = !!call?.heldAt;
  const shoot = eventDay(p.eventDate);

  // A new inquiry that has had an answer (one written without the inquiry
  // reply, or marked handled on Today) is past replying to.
  const answered =
    (!status || status === "new-inquiry") &&
    (!!p.lastOutAt || hiddenByMark(p.todayDismissed?.inquiry, today));

  switch (answered ? "responded" : status) {
    case undefined:
    case "new-inquiry":
      return {
        title: "Reply to the inquiry",
        detail: "Compose opens on the inquiry reply.",
        action: { label: "Draft a reply", href: draftReplyHref(page) },
      };

    case "responded": {
      const typed = !!call?.notes?.trim() || Object.values(call?.answers ?? {}).some((a) => a.trim());
      if (typed) {
        return {
          title: "Save the call summary",
          detail: "Your call notes are in. Summarize them, and the recap follows.",
          action: { label: "Open the call", href: tab("call") },
        };
      }
      // The inquiry reply carries the call link too.
      if (sent.has("discovery-invite") || sent.has("inquiry-reply")) {
        return {
          title: "Hold the discovery call",
          detail: "The invite is out. The guide for the call is ready.",
          action: { label: "Open the call guide", href: tab("call") },
        };
      }
      return {
        title: "Invite them to a discovery call",
        action: { label: "Write the invite", href: compose("discovery-invite") },
      };
    }

    case "in-conversation":
      if (!has("proposal")) {
        return {
          title: "Add the proposal link",
          detail: callHeld ? "The recap email carries it." : "The proposal email carries it.",
          action: { label: "Add a link", href: tab("links") },
        };
      }
      return callHeld
        ? {
            title: "Send the recap and proposal",
            action: { label: "Write the recap", href: compose("discovery-recap") },
          }
        : {
            title: "Send the proposal",
            action: { label: "Write the email", href: compose("proposal") },
          };

    case "proposal-sent":
      if (has("contract") && unpaid.length) {
        return {
          title: "Send the contract and retainer",
          action: { label: "Write the email", href: compose("contract-deposit") },
        };
      }
      // A hold that ran out, until a follow-up is set past it (the follow-up
      // email sets one).
      if (
        p.holdUntil &&
        DAY.test(p.holdUntil) &&
        p.holdUntil < today &&
        !(p.followUpAt && p.followUpAt > p.holdUntil)
      ) {
        return {
          title: "The date hold ended",
          detail: `It ran until ${formatHumanDate(p.holdUntil)}. Follow up, or let the date go.`,
          action: { label: "Write a follow-up", href: compose("proposal-follow-up") },
        };
      }
      if (p.followUpAt && DAY.test(p.followUpAt) && p.followUpAt <= today) {
        return {
          title: "Follow up on the proposal",
          action: { label: "Write a follow-up", href: compose("proposal-follow-up") },
        };
      }
      return {
        title: `Waiting on ${first}'s answer`,
        detail: "When they say yes, add the Square contract and invoice.",
        action: { label: "Add the contract", href: tab("links") },
      };

    case "booked":
      if (!has("contract") || !invoices.length) {
        return {
          title: "Add the Square contract and invoice",
          detail: "The client signs and pays the retainer from these.",
          action: { label: "Add a link", href: tab("links") },
        };
      }
      // The retainer is the first invoice paid; a balance invoice left open
      // belongs to delivery.
      if (invoices.some((d) => d.paidAt)) {
        return {
          title: "Send the booking welcome",
          detail: "The retainer is paid.",
          action: { label: "Write the welcome", href: compose("booking-welcome") },
        };
      }
      // Set to Booked by hand: the email with the signing and payment links
      // hasn't gone yet.
      if (!sent.has("contract-deposit")) {
        return {
          title: "Send the contract and retainer",
          action: { label: "Write the email", href: compose("contract-deposit") },
        };
      }
      if (overdue) {
        return {
          title: "The retainer is overdue",
          detail: dueLine,
          action: { label: "Send a reminder", href: compose("payment-reminder") },
        };
      }
      return {
        title: "Waiting on the signed contract and retainer",
        detail: [dueLine, "Mark the invoice paid when it comes in."].filter(Boolean).join(" "),
        action: { label: "Mark it paid", href: tab("links") },
      };

    case "contract-signed": {
      // Set to Contract signed by hand: the welcome hasn't gone yet.
      if (!sent.has("booking-welcome")) {
        return {
          title: "Send the booking welcome",
          action: { label: "Write the welcome", href: compose("booking-welcome") },
        };
      }
      if (shoot && daysBetween(today, shoot) > PLANNING_WINDOW_DAYS) {
        const start = formatHumanDate(shiftDay(shoot, { days: -PLANNING_WINDOW_DAYS }));
        return {
          title: "Booked",
          detail: `Planning starts about two months before the shoot, around ${start}. Nothing to send yet.`,
        };
      }
      return {
        title: "Start planning",
        detail: ctx.questionnaire ? "The kickoff email sends the questionnaire." : undefined,
        action: { label: "Write the kickoff", href: compose("planning-kickoff") },
      };
    }

    case "planning":
      if (ctx.questionnaire && !p.questionnaireSnapshot?.trim()) {
        return {
          title: "Waiting on the questionnaire",
          detail: sent.has("questionnaire-reminder") ? "A reminder went out." : undefined,
          action: { label: "Send a reminder", href: compose("questionnaire-reminder") },
        };
      }
      return {
        title: "Send the timeline details",
        action: { label: "Write the email", href: compose("timeline-details") },
      };

    case "scheduled": {
      if (!shoot) {
        return {
          title: "Set the shoot date",
          action: { label: "Open details", href: tab("details") },
        };
      }
      const days = daysBetween(today, shoot);
      if (days < 0) {
        return {
          title: "Send the thank-you",
          detail: `The shoot was ${formatHumanDate(shoot)}.`,
          action: { label: "Write the thank-you", href: compose("post-shoot-thank-you") },
        };
      }
      if (days <= 7 && !sent.has("week-of")) {
        return {
          title: "Send the week-of email",
          detail: `The shoot is ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}.`,
          action: { label: "Write the email", href: compose("week-of") },
        };
      }
      return {
        title: days === 0 ? "Shoot today" : `Shoot ${days === 1 ? "tomorrow" : `in ${days} days`}`,
        detail: `${formatHumanDate(shoot)}. Nothing to send yet.`,
      };
    }

    case "shot":
      return {
        title: "Send the thank-you",
        action: { label: "Write the thank-you", href: compose("post-shoot-thank-you") },
      };

    case "editing": {
      const due =
        shoot && ctx.turnaroundDays
          ? `The gallery is due ${formatHumanDate(shiftDay(shoot, { days: ctx.turnaroundDays }))}.`
          : undefined;
      if (has("highlights") && !sent.has("sneak-peek")) {
        return {
          title: "Send the sneak peek",
          detail: due,
          action: { label: "Write the email", href: compose("sneak-peek") },
        };
      }
      return {
        title: has("highlights") || sent.has("sneak-peek") ? "Add the gallery" : "Add the highlights or the gallery",
        detail: [due, "Adding a link emails no one."].filter(Boolean).join(" "),
        action: { label: "Add a link", href: tab("links") },
      };
    }

    case "delivered":
      if (!has("gallery")) {
        return {
          title: "Add the gallery",
          action: { label: "Add a link", href: tab("links") },
        };
      }
      if (!sent.has("gallery-delivery")) {
        return {
          title: "Send the gallery",
          action: { label: "Write the email", href: compose("gallery-delivery") },
        };
      }
      if (unpaid.length) {
        return {
          title: overdue ? "The final invoice is overdue" : "Waiting on the final invoice",
          detail: dueLine,
          action: { label: "Send a reminder", href: compose("payment-reminder") },
        };
      }
      return {
        title: "Ask for a review",
        action: { label: "Write the request", href: compose("review-request") },
      };

    case "complete":
      if (!sent.has("referral-ask")) {
        return {
          title: "Ask for a referral",
          action: { label: "Write the email", href: compose("referral-ask") },
        };
      }
      return { title: "All done", detail: "The anniversary email is there when the date comes around." };

    default:
      return { title: "Open the project", action: { label: "Open details", href: tab("details") } };
  }
}
