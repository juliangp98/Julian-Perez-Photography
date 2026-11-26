// The one next step on a project, for the owner: worked out from where the
// project stands with rules, not AI, and shown at the top of the project page
// with one button. A step that waits on the client says so, and its button is
// the thing to do meanwhile (or none). Pure, so the page and the specs share it.

import { CLIENT_STATUS_TERMINAL, type ClientStatus } from "./client-status";
import { EMAIL_TEMPLATES } from "./email/email-pipeline";
import { dayAgo, daysBetween, eventDay, formatHumanDate, shiftDay, studioDayOf } from "./field-format";
import { openInvoice } from "./project-links";
import { hiddenByMark, lostAt, replyKey } from "./today";
import { draftReplyHref } from "./triage";

export type NextStep = {
  // What to do, or what it's waiting on.
  title: string;
  // Why, or what comes after, in a sentence.
  detail?: string;
  action?: { label: string; href: string };
  // The template the action sends, when it goes once: the owner can record
  // that it already went another way (from Gmail, say), which moves the
  // project on as sending it would.
  once?: string;
  // For a client's message waiting on an answer, the Today row it shares
  // (src/lib/today.ts): marking it handled settles both.
  handled?: string;
};

// Templates a step may offer again and again, so "already sent" doesn't
// settle them.
const REPEATS = new Set(["payment-reminder", "proposal-follow-up", "questionnaire-reminder"]);

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
  // Its moves, for when a lost lead was closed.
  statusHistory?: { status?: string; changedAt?: string; kind?: string }[];
};

export type NextStepContext = {
  // The studio's calendar day.
  today: string;
  // The templates already sent on this project, each with the studio day it
  // last went out ("" when only the activity log tells of it).
  sent: ReadonlyMap<string, string>;
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

// The templates already sent on a project, from its outgoing emails, with
// the studio day each last went out. An email records the template it started
// from, and counts once it went out (a bounced or failed one doesn't). An
// email sent before that was recorded counts when its subject still reads as
// a template's, or when the activity log notes the send ("<template name>
// sent", written when it moved the project) and no recorded email carries
// that template, so a step done before then isn't offered again. One the
// owner noted as sent another way ("<template name> noted as sent") always
// counts.
export function sentTemplates(
  messages: { direction: string; template?: string; subject?: string; sentAt?: string; wentOut: boolean }[],
  history: { note?: string }[] = [],
): Map<string, string> {
  const sent = new Map<string, string>();
  const recorded = new Set<string>();
  const mark = (id: string, at?: string) => {
    const day = at ? studioDayOf(at) : "";
    if (!sent.has(id) || day > (sent.get(id) ?? "")) sent.set(id, day);
  };
  for (const m of messages) {
    if (m.direction !== "out") continue;
    if (m.template) {
      recorded.add(m.template);
      if (m.wentOut) mark(m.template, m.sentAt);
      continue;
    }
    if (!m.wentOut) continue;
    const subject = m.subject?.trim() ?? "";
    for (const t of SUBJECT_PATTERNS) if (subject && t.pattern.test(subject)) mark(t.id, m.sentAt);
  }
  for (const h of history) {
    const noted = EMAIL_TEMPLATES.find((x) => h.note === notedAsSent(x.name));
    const moved = EMAIL_TEMPLATES.find((x) => h.note === `${x.name} sent`);
    const t = noted ?? (moved && !recorded.has(moved.id) ? moved : undefined);
    if (t && !sent.has(t.id)) sent.set(t.id, "");
  }
  return sent;
}

// What the activity log says when the owner notes a template as sent another
// way (Already sent on the next step).
export const notedAsSent = (templateName: string) => `${templateName} noted as sent`;

export function ownerNextStep(p: NextStepProject, ctx: NextStepContext): NextStep {
  const step = stepFor(p, ctx);
  const template = step.action?.href.match(/[?&]compose=([a-z-]+)/)?.[1];
  return template && !REPEATS.has(template) && !step.handled ? { ...step, once: template } : step;
}

function stepFor(p: NextStepProject, ctx: NextStepContext): NextStep {
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
  const nextDue = openInvoice(p, today);
  const dueLine =
    nextDue?.dueAt && DAY.test(nextDue.dueAt)
      ? nextDue.dueAt < today
        ? `It was due ${formatHumanDate(nextDue.dueAt)}.`
        : `It's due ${nextDue.dueAt === today ? "today" : formatHumanDate(nextDue.dueAt)}.`
      : undefined;
  const overdue = !!nextDue?.dueAt && DAY.test(nextDue.dueAt) && nextDue.dueAt < today;

  // The client wrote last and hasn't had an answer, unless their message was
  // marked handled (or snoozed) on the Today list.
  const unanswered =
    !!p.lastInAt &&
    (!p.lastOutAt || p.lastInAt > p.lastOutAt) &&
    !hiddenByMark(p.todayDismissed?.[replyKey(p.lastInAt)], today);
  const answer = (): NextStep => ({
    title: `Answer ${first}`,
    detail: `${First} wrote ${dayAgo(studioDayOf(p.lastInAt ?? ""), today)}.`,
    action: { label: "Write a reply", href: `${page}?tab=messages#compose` },
    handled: replyKey(p.lastInAt ?? ""),
  });

  if (CLIENT_STATUS_TERMINAL.includes(status as ClientStatus)) {
    if (status === "lost") {
      // A lost lead writing back after the close is the point of the check-in.
      const closedAt = lostAt(p.statusHistory);
      if (unanswered && (!closedAt || Date.parse(p.lastInAt ?? "") > Date.parse(closedAt))) return answer();
      if (sent.has("re-engagement")) {
        return { title: "Closed as lost", detail: "A check-in went out. If they write back, it shows here." };
      }
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

  // An unanswered client comes before the stage's step. A new inquiry
  // nothing has gone to yet gets the inquiry reply.
  if (unanswered) {
    const lead = (!status || status === "new-inquiry") && !p.lastOutAt;
    return lead ? { ...answer(), action: { label: "Draft a reply", href: draftReplyHref(page) } } : answer();
  }

  const call = p.calls?.discovery;
  // Held means the summary was saved after a call; a project moved to In
  // conversation by hand had no call.
  const callHeld = !!call?.heldAt;
  const shoot = eventDay(p.eventDate);

  // The proposal's link, then the email that carries it: the recap after a
  // held call, or the proposal without one.
  const sendProposal = (): NextStep => {
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
  };

  // A new inquiry that has had an answer (one written without the inquiry
  // reply), or that was marked handled on Today (the inquiry, or the client's
  // message), is past replying to. A snooze only puts it off.
  const handled = (key: string) => p.todayDismissed?.[key] === "handled";
  const answered =
    (!status || status === "new-inquiry") &&
    (!!p.lastOutAt || handled("inquiry") || (!!p.lastInAt && handled(replyKey(p.lastInAt))));

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
      return sendProposal();

    case "proposal-sent": {
      // The contract went another way and the retainer is in: they're booked
      // (a balance invoice left open belongs to delivery).
      if (has("contract") && invoices.some((d) => d.paidAt)) {
        return {
          title: "Send the booking welcome",
          detail: "The retainer is paid.",
          action: { label: "Write the welcome", href: compose("booking-welcome") },
        };
      }
      if (has("contract") && unpaid.length) {
        return {
          title: "Send the contract and retainer",
          action: { label: "Write the email", href: compose("contract-deposit") },
        };
      }
      // Set to Proposal sent by hand, or the email bounced: it hasn't reached them.
      if (!sent.has("discovery-recap") && !sent.has("proposal")) return sendProposal();
      // A hold that ran out, until it's followed up after it ended or marked
      // handled on Today.
      const followedUp = (sent.get("proposal-follow-up") ?? "") >= (p.holdUntil ?? "");
      if (
        p.holdUntil &&
        DAY.test(p.holdUntil) &&
        p.holdUntil < today &&
        !followedUp &&
        !hiddenByMark(p.todayDismissed?.[`hold:${p.holdUntil}`], today)
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
      // The contract added and the invoice still to come: that's what's missing.
      return has("contract")
        ? {
            title: `Waiting on ${first}'s answer`,
            detail: "The contract is added. Add the invoice to send them both.",
            action: { label: "Add the invoice", href: tab("links") },
          }
        : {
            title: `Waiting on ${first}'s answer`,
            detail: "When they say yes, add the Square contract and invoice.",
            action: { label: "Add the contract", href: tab("links") },
          };
    }

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
      if (!has("timeline")) {
        return {
          title: "Add the timeline",
          detail: "The timeline email carries it.",
          action: { label: "Add a link", href: tab("links") },
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
      // Asked for already, while the status hasn't moved to Complete.
      if (sent.has("review-request")) {
        return { title: "Review asked for", detail: "Set the status to Complete once it's in." };
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
