// The one next step on a project, for the owner: worked out from where the
// project stands with rules, not AI, and shown at the top of the project page
// with one button. A step that waits on the client says so, and its button is
// the thing to do meanwhile (or none). Pure, so the page and the specs share it.

import { CLIENT_STATUS_TERMINAL, type ClientStatus } from "./client-status";
import { EMAIL_TEMPLATES } from "./email/email-pipeline";
import {
  dayAgo,
  daysBetween,
  eventDay,
  formatHumanDate,
  settledEventDate,
  shiftDay,
  studioDayOf,
  weekdayOf,
} from "./field-format";
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
  // For a step the Today list shows too (a client's message waiting on an
  // answer, a date hold that ran out), the row it shares (src/lib/today.ts):
  // marking it handled settles both.
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

// An outgoing email as the rules read it: whether it went out, and the
// template it started from or its subject (sentEmail in messages.ts).
export type SentEmail = { direction: string; template?: string; subject?: string; sentAt?: string; wentOut: boolean };

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
  messages: SentEmail[],
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

// The template a step's action sends once, if it sends one (a reminder can go
// again and again).
function onceTemplate(step: NextStep): string | undefined {
  const template = step.action?.href.match(/[?&]compose=([a-z-]+)/)?.[1];
  return template && !REPEATS.has(template) ? template : undefined;
}

export function ownerNextStep(p: NextStepProject, ctx: NextStepContext): NextStep {
  const step = stepFor(p, ctx);
  if (step.once || step.handled) return step;
  const template = onceTemplate(step);
  return template ? { ...step, once: template } : step;
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

  // A lead answered outside the site: its inquiry, or a message of theirs,
  // marked handled on Today.
  const answeredByHand =
    p.todayDismissed?.inquiry === "handled" ||
    Object.entries(p.todayDismissed ?? {}).some(([k, v]) => k.startsWith("reply:") && v === "handled");

  // An unanswered client comes before the stage's step. A new inquiry
  // nothing has gone to yet, and none was marked handled on Today, gets the
  // inquiry reply.
  if (unanswered) {
    const lead = (!status || status === "new-inquiry") && !p.lastOutAt && !answeredByHand && !has("contract");
    return lead ? { ...answer(), action: { label: "Draft a reply", href: draftReplyHref(page) } } : answer();
  }

  const call = p.calls?.discovery;
  // Held means the summary was saved after a call; a project moved to In
  // conversation by hand had no call.
  const callHeld = !!call?.heldAt;
  const shoot = eventDay(p.eventDate);

  // After the shoot: the thank-you, which moves it to Editing.
  const thankYou = (): NextStep => ({
    title: "Send the thank-you",
    detail: `The shoot was ${formatHumanDate(shoot)}.`,
    action: { label: "Write the thank-you", href: compose("post-shoot-thank-you") },
  });

  // Notes typed on the Call tab and the summary not saved yet.
  const typed = !!call?.notes?.trim() || Object.values(call?.answers ?? {}).some((a) => a.trim());
  const saveSummary: NextStep = {
    title: "Save the call summary",
    detail: "Your call notes are in. Summarize them, and the recap follows.",
    action: { label: "Open the call", href: tab("call") },
  };

  // Reserving the date: the Square paperwork, the email that carries it, the
  // retainer, then the booking welcome once it's paid (a balance invoice
  // left open belongs to delivery).
  const reserving = (): NextStep => {
    if (!has("contract") || !invoices.length) {
      return {
        title: "Add the Square contract and invoice",
        detail: "The client signs and pays the retainer from these.",
        action: { label: "Add a link", href: tab("links") },
      };
    }
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
  };
  // A project moved past Booked before the booking was done (the client's
  // questionnaire moves a booked project to Planning): while its Square
  // contract and invoice are on the project and the welcome hasn't gone,
  // that comes first. Its steps offer Already sent only for the email they
  // send: once the retainer is marked paid, the welcome step offers it for
  // a welcome that went another way.
  const unreserved = bookingOpen(docs, sent.has("booking-welcome"));

  // A Square contract on a lead means they said yes, whatever came before (a
  // proposal skipped, a booking made on the call): with the retainer paid,
  // the booking welcome (a balance invoice left open belongs to delivery);
  // with an invoice to pay, the email that sends them both; without one, the
  // invoice.
  const booking = (): NextStep | undefined => {
    if (!has("contract")) return undefined;
    if (invoices.some((d) => d.paidAt)) {
      return {
        title: "Send the booking welcome",
        detail: "The retainer is paid.",
        action: { label: "Write the welcome", href: compose("booking-welcome") },
      };
    }
    if (unpaid.length) {
      return {
        title: "Send the contract and retainer",
        action: { label: "Write the email", href: compose("contract-deposit") },
      };
    }
    return {
      title: "Add the invoice",
      detail: "The contract is added. The email sends them both.",
      action: { label: "Add a link", href: tab("links") },
    };
  };

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
  // reply, or one outside the site) is past replying to. A snooze on Today
  // only puts it off.
  const answered = (!status || status === "new-inquiry") && (!!p.lastOutAt || answeredByHand);

  switch (answered ? "responded" : status) {
    case undefined:
    case "new-inquiry":
      return (
        booking() ?? {
          title: "Reply to the inquiry",
          detail: "Compose opens on the inquiry reply.",
          action: { label: "Draft a reply", href: draftReplyHref(page) },
        }
      );

    case "responded": {
      const yes = booking();
      if (yes) return yes;
      // A call already held (its summary saved) is past: the proposal comes next.
      if (callHeld) return sendProposal();
      if (typed) return saveSummary;
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
      // Notes from a call not yet summarized: the recap comes from the summary.
      return booking() ?? (!callHeld && typed ? saveSummary : sendProposal());

    case "proposal-sent": {
      const yes = booking();
      if (yes) return yes;
      // Set to Proposal sent by hand, or the email bounced: it hasn't reached them.
      if (!sent.has("discovery-recap") && !sent.has("proposal")) return sendProposal();
      // A hold that ran out, until its Today row is settled: marked handled
      // or snoozed on Today, marked handled here, or by a proposal follow-up
      // sent from Compose on or after the hold's last day (the send marks
      // the row), so the page and Today read the same mark.
      if (
        p.holdUntil &&
        DAY.test(p.holdUntil) &&
        p.holdUntil < today &&
        !hiddenByMark(p.todayDismissed?.[`hold:${p.holdUntil}`], today)
      ) {
        return {
          title: "The date hold ended",
          detail: `It ran until ${formatHumanDate(p.holdUntil)}. Follow up, or let the date go.`,
          action: { label: "Write a follow-up", href: compose("proposal-follow-up") },
          handled: `hold:${p.holdUntil}`,
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
    }

    case "booked":
      return reserving();

    case "contract-signed": {
      // Set to Contract signed by hand: the welcome hasn't gone yet.
      if (!sent.has("booking-welcome")) {
        return {
          title: "Send the booking welcome",
          action: { label: "Write the welcome", href: compose("booking-welcome") },
        };
      }
      // The shoot came and went with no planning email moving it on (the
      // client's page reads it as past, shootPassed).
      if (shootPassed(p, today)) return thankYou();
      if (shoot && daysBetween(today, shoot) > PLANNING_WINDOW_DAYS) {
        const start = formatHumanDate(shiftDay(shoot, { days: -PLANNING_WINDOW_DAYS }));
        return {
          title: "Booked",
          detail: `Planning starts about two months before the shoot, around ${start}. Nothing to send yet.`,
        };
      }
      return {
        title: "Start planning",
        detail:
          ctx.questionnaire && !p.questionnaireSnapshot?.trim() ? "The kickoff email sends the questionnaire." : undefined,
        action: { label: "Write the kickoff", href: compose("planning-kickoff") },
      };
    }

    case "planning":
      if (unreserved) return reserving();
      if (shootPassed(p, today)) return thankYou();
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
      // Until the shoot (or with no day set), a booking left undone comes
      // first, as the client's page reads it (stillReserving).
      if (unreserved && (!shoot || daysBetween(today, shoot) >= 0)) return reserving();
      if (!shoot) {
        return {
          title: "Set the shoot date",
          action: { label: "Open details", href: tab("details") },
        };
      }
      const days = daysBetween(today, shoot);
      if (days < 0) return thankYou();
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
      // The gallery already on (the status set back by hand): its email next.
      if (has("gallery") && !sent.has("gallery-delivery")) {
        return {
          title: "Send the gallery",
          action: { label: "Write the email", href: compose("gallery-delivery") },
        };
      }
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

// ── The client's next step ──
//
// The one thing a client does next (or is waiting on), shown at the top of
// their portal page with one button and sometimes a second: the same stages
// as the owner's steps, said to the client. Links come from the caller, so
// this stays pure: the questionnaire (prefilled), the call bookings, the
// review page and the how-to-pay line.

type BookingDoc = { type?: string; uploadedBy?: string; paidAt?: string };

// Julian's own entry of a kind is on the project (a client's upload never
// stands in for it).
const julians = (docs: BookingDoc[] = [], type: string) =>
  docs.some((d) => d.type === type && d.uploadedBy !== "client");

// Julian's Square contract on a lead means they said yes, whatever came
// before (a proposal skipped, a booking made on the call). Both next steps
// read it so.
const LEAD_STATUSES: readonly (string | undefined)[] = [
  undefined,
  "new-inquiry",
  "responded",
  "in-conversation",
  "proposal-sent",
];

// Julian's Square contract and an invoice are on the project and the booking
// welcome hasn't gone out: the booking isn't finished, whatever the status
// says (the client's questionnaire moves a booked project to Planning).
function bookingOpen(docs: BookingDoc[] = [], welcomed: boolean): boolean {
  return julians(docs, "contract") && julians(docs, "invoice") && !welcomed;
}

// For the client, a project whose date is being reserved though its status
// says otherwise: a lead with Julian's contract on it, or a project moved
// past Booked while its booking is open and none of its invoices is paid
// (in Planning, or in Scheduled up to the shoot, the projects the owner's
// step sends back to the booking). Their page asks them to sign and pay, and
// its status and tracker read Reserving your date.
export function stillReserving(
  p: { status?: string; eventDate?: string; documents?: BookingDoc[] },
  welcomed: boolean,
  today: string,
): boolean {
  if (LEAD_STATUSES.includes(p.status)) return julians(p.documents, "contract") && !welcomed;
  if (!bookingOpen(p.documents, welcomed)) return false;
  if (p.documents?.some((d) => d.type === "invoice" && d.uploadedBy !== "client" && d.paidAt)) return false;
  if (p.status === "planning") return true;
  if (p.status !== "scheduled") return false;
  const shoot = eventDay(p.eventDate);
  return !shoot || daysBetween(today, shoot) >= 0;
}

// The statuses a project can still hold after its shoot when no week-of or
// thank-you email moved it on.
const BEFORE_SHOOT = ["contract-signed", "planning", "scheduled"];

// A project whose shoot is past while its status still reads as before it:
// the client's page shows what comes after (the editing step), its status
// reads Captured and its tracker moves to Editing, and the owner's step is the
// thank-you. For the client, a date still being reserved comes first.
export function shootPassed(p: { status?: string; eventDate?: string }, today: string): boolean {
  if (!BEFORE_SHOOT.includes(p.status ?? "")) return false;
  const shoot = eventDay(p.eventDate);
  return !!shoot && daysBetween(today, shoot) < 0;
}

export type ClientStep = {
  title: string;
  detail?: string;
  action?: { label: string; href: string; external?: boolean };
  secondary?: { label: string; href: string; external?: boolean };
};

export type ClientStepProject = {
  status?: string;
  eventDate?: string;
  questionnaireSnapshot?: string;
  documents?: { type?: string; url?: string; uploadedBy?: string; dueAt?: string; paidAt?: string }[];
  planSummary?: string;
  // The date is being reserved though the status says otherwise (a lead with
  // Julian's contract, or a project moved past Booked before the booking was
  // done: stillReserving, worked out with the emails sent).
  reserving?: boolean;
};

export type ClientStepContext = {
  today: string;
  // The date hold running, if any.
  holdUntil?: string;
  // The service's planning questionnaire, prefilled; unset when it has none.
  questionnaireUrl?: string;
  discoveryCallUrl?: string;
  // The call that plans the shoot (planningCallFor): the timeline call for a
  // wedding, the planning call otherwise.
  planningCall?: { kind: "timeline" | "planning"; url: string };
  reviewUrl?: string;
  // Where a client signs in to their galleries (Pic-Time).
  galleryLoginUrl?: string;
  // How to pay with the method chosen.
  paymentLine?: string;
};

export function clientNextStep(p: ClientStepProject, ctx: ClientStepContext): ClientStep | undefined {
  const status = p.status as ClientStatus | undefined;
  if (CLIENT_STATUS_TERMINAL.includes(status as ClientStatus)) return undefined;
  const { today } = ctx;
  const docs = p.documents ?? [];
  // Julian's own entry of a kind, the newest (a client's upload never stands in).
  const own = (type: string) => docs.filter((d) => d.type === type && d.uploadedBy !== "client" && d.url).at(-1);
  const link = (label: string, url?: string) => (url ? { label, href: url, external: true } : undefined);
  // When an invoice is due, as the owner's step words it.
  const dueLine = (what: string, dueAt?: string) =>
    dueAt && DAY.test(dueAt)
      ? dueAt < today
        ? `${what} was due ${formatHumanDate(dueAt)}.`
        : `${what} is due ${dueAt === today ? "today" : formatHumanDate(dueAt)}.`
      : undefined;
  const invoice = openInvoice(p, today);
  const invoiceLink = invoice?.url ? { label: "Pay the invoice", href: invoice.url, external: true } : undefined;
  const shoot = eventDay(p.eventDate);
  const editing: ClientStep = own("highlights")
    ? {
        title: "Your highlights are ready",
        detail: "A first look while I finish your gallery.",
        action: link("View your highlights", own("highlights")?.url),
      }
    : { title: "I'm editing your photos", detail: "Your gallery comes next. I'll email you the moment it's ready." };

  // Reserving the date, read as the owner's step reads it: the date is
  // reserved once one of Julian's invoices is paid (a balance invoice left
  // open belongs to delivery), and until then the retainer is the invoice
  // the contract email names (openInvoice).
  const invoices = docs.filter((d) => d.type === "invoice" && d.uploadedBy !== "client");
  const reserving = (): ClientStep => {
    const contract = own("contract");
    if (!contract) {
      // The invoice can come before the contract.
      if (invoices.some((d) => d.paidAt)) {
        return { title: "Your retainer is in", detail: "Thank you. Your contract is on its way." };
      }
      if (invoices.length) {
        return {
          title: "Your contract is on its way",
          detail: [dueLine("The retainer", invoice?.dueAt), ctx.paymentLine].filter(Boolean).join(" ") || undefined,
          secondary: link("Pay the retainer", invoice?.url),
        };
      }
      return { title: "Your contract is on its way", detail: "It comes with the invoice for the retainer." };
    }
    if (invoices.some((d) => d.paidAt)) {
      return {
        title: "Your retainer is in",
        detail: "Thank you. Your booking confirmation is on its way.",
        action: link("View your contract", contract.url),
      };
    }
    if (!invoices.length) {
      return {
        title: "Sign your contract",
        detail: "The invoice for the retainer is on its way.",
        action: link("Sign the contract", contract.url),
      };
    }
    return {
      title: "Sign your contract and pay the retainer",
      detail: [dueLine("The retainer", invoice?.dueAt), ctx.paymentLine, "Your date is reserved once both are in."]
        .filter(Boolean)
        .join(" "),
      action: link("Sign the contract", contract.url),
      secondary: link("Pay the retainer", invoice?.url),
    };
  };
  // A lead with Julian's contract on it is reserving its date
  // (stillReserving).
  const lead = (step: ClientStep): ClientStep => (p.reserving ? reserving() : step);
  // A shoot already past: what comes after it, whatever the planning left.
  const shot = shootPassed(p, today);
  // The shoot, said by how soon it is, with the plan when there is one.
  const days = shoot ? daysBetween(today, shoot) : undefined;
  const shootStep = (): ClientStep => {
    const when =
      days === undefined
        ? undefined
        : days === 0
          ? "today"
          : days === 1
            ? "tomorrow"
            : days < 7
              ? `on ${weekdayOf(shoot)}`
              : `on ${formatHumanDate(shoot)}`;
    return {
      title: when ? `Your shoot is ${when}` : "Your shoot is on the calendar",
      detail: [p.planSummary?.trim() ? "Your plan is below." : undefined, "Write to me here with anything that changes."]
        .filter(Boolean)
        .join(" "),
      action: link("View your timeline", own("timeline")?.url),
    };
  };

  switch (status) {
    case undefined:
    case "new-inquiry":
    case "responded":
      return lead(
        // Julian's proposal link on before the email that carries it (no
        // call): it's ready.
        own("proposal")
          ? { title: "Your proposal is ready", action: link("View your proposal", own("proposal")?.url) }
          : ctx.discoveryCallUrl
          ? {
              title: "Book a discovery call",
              detail:
                "A short call so I can hear what you're planning and answer your questions. Already booked? I'll see you then.",
              action: link("Pick a time", ctx.discoveryCallUrl),
            }
          : { title: "I'll be in touch soon", detail: "I read every inquiry and reply myself." },
      );

    case "in-conversation":
      // Julian's proposal link on before the email that carries it: it's ready.
      return lead(
        own("proposal")
          ? { title: "Your proposal is ready", action: link("View your proposal", own("proposal")?.url) }
          : { title: "Your proposal is on its way", detail: "I'm putting it together from our conversation." },
      );

    case "proposal-sent": {
      const held = ctx.holdUntil ? `I'm holding your date until ${formatHumanDate(ctx.holdUntil)}.` : undefined;
      return lead(
        own("proposal")
          ? { title: "Your proposal is ready", detail: held, action: link("View your proposal", own("proposal")?.url) }
          : { title: "Your proposal is on its way", detail: held },
      );
    }

    case "booked":
      return reserving();

    case "contract-signed": {
      if (shot) return editing;
      // The week of the shoot: the shoot itself.
      if (days !== undefined && days < 7) return shootStep();
      // Only a service with a questionnaire gets one, and only once: answers
      // sent before the booking count. Inside the planning window it's due.
      const ahead = days === undefined || days > PLANNING_WINDOW_DAYS ? "closer to the day" : "soon";
      // The questionnaire is on their page already (the callout below).
      const later =
        ctx.questionnaireUrl && !p.questionnaireSnapshot?.trim()
          ? `Your planning questionnaire is below whenever you're ready, and I'll remind you ${ahead}.`
          : `I'll be in touch to plan ${ahead}.`;
      // The date when it's settled, or none claimed (a hedge or "TBD").
      const named = settledEventDate(p.eventDate);
      return {
        title: "You're booked",
        detail: named ? `${named} is yours. ${later}` : `You're all set. ${later}`,
      };
    }

    case "planning": {
      if (p.reserving) return reserving();
      if (shot) return editing;
      // The eve of the shoot, or the day: the shoot itself.
      if (days !== undefined && days <= 1) return shootStep();
      if (ctx.questionnaireUrl && !p.questionnaireSnapshot?.trim()) {
        return {
          title: "Fill in your planning questionnaire",
          detail: "What you already told me is filled in. It goes straight back to this project.",
          action: { label: "Open the questionnaire", href: ctx.questionnaireUrl },
        };
      }
      const timeline = own("timeline");
      if (timeline) {
        return {
          title: "Your timeline is ready",
          detail: "Have a look, and write to me here with anything to change.",
          action: link("View your timeline", timeline.url),
        };
      }
      const call = ctx.planningCall;
      if (call?.url) {
        return call.kind === "timeline"
          ? {
              title: "Book your timeline call",
              detail: "We'll walk through the day together and set the timeline. Already booked? I'll see you then.",
              action: link("Pick a time", call.url),
            }
          : {
              title: "Book your planning call",
              detail: "We'll go over your plans together before the shoot. Already booked? I'll see you then.",
              action: link("Pick a time", call.url),
            };
      }
      return ctx.questionnaireUrl
        ? { title: "Thanks for your answers", detail: "I'll send your timeline soon." }
        : { title: "Your timeline is on its way", detail: "I'll send it before the shoot." };
    }

    case "scheduled":
      // Until the shoot, a booking left undone comes first.
      if (p.reserving) return reserving();
      return shot ? editing : shootStep();

    case "shot":
    case "editing":
      return editing;

    case "delivered": {
      const open = invoices.filter((d) => !d.paidAt).length;
      // The invoice the button pays, and when it's due.
      const owed = invoiceLink
        ? [
            open > 1 ? `There are ${open} invoices still open.` : "There's one invoice still open.",
            dueLine(open > 1 ? "The next one" : "It", invoice?.dueAt),
            ctx.paymentLine,
          ]
            .filter(Boolean)
            .join(" ")
        : undefined;
      const gallery = own("gallery");
      // Delivered with no gallery link on the project (sent in an email, or
      // set by hand): it's in their email, and their galleries are a sign-in
      // away.
      return {
        title: "Your gallery is ready",
        detail: gallery
          ? (owed ?? "View, download and share your photos.")
          : ["The link is in your email.", owed].filter(Boolean).join(" "),
        action: gallery ? link("View your gallery", gallery.url) : link("Sign in to your galleries", ctx.galleryLoginUrl),
        secondary: invoiceLink,
      };
    }

    case "complete":
      return {
        title: ctx.reviewUrl ? "Leave a review" : "Thank you",
        detail: ctx.reviewUrl
          ? "If you loved your photos, a few words help the next client find me."
          : "It was a joy working with you.",
        action: link("Write a review", ctx.reviewUrl),
        // Back to the photos: Julian's gallery link, else the gallery sign-in.
        secondary: link("View your gallery", own("gallery")?.url) ?? link("Sign in to your galleries", ctx.galleryLoginUrl),
      };

    default:
      return undefined;
  }
}
