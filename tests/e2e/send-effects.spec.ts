import { test, expect } from "@playwright/test";
import {
  EMAIL_TEMPLATES,
  EMAIL_TOKENS,
  OPTIONAL_TOKENS,
  fillTemplate,
  unfilledParts,
  type EmailTemplate,
} from "../../src/lib/email/email-pipeline";
import { CLIENT_STATUS_FLOW, statusRank } from "../../src/lib/client-status";
import { preparingForShoot, questionnaireOutstanding } from "../../src/lib/next-step";
import { sampleGalleryFor } from "../../src/lib/services-data";
import { SITE_URL } from "../../src/lib/site-settings-data";
import {
  planSendEffects,
  heldUntil,
  holdUntilFor,
  planEffectsLine,
  templateEffectsLine,
} from "../../src/lib/email/send-effects";
import { CLIENT_STATUS_OPTIONS } from "../../src/lib/client-status";

// What sending a pipeline email does to its project, as planned from the
// template (src/lib/email/send-effects.ts), and the templates themselves. The
// send route applies the plan; tests/e2e/send-email.spec.ts covers that end.

const TODAY = "2026-11-25";
const template = (id: string): EmailTemplate => {
  const t = EMAIL_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};
const plan = (id: string, project: Parameters<typeof planSendEffects>[1], holdDays?: number) =>
  planSendEffects(template(id), project, { today: TODAY, holdDays });

test("an inquiry reply moves a new inquiry on and sets a follow-up three days out", () => {
  expect(plan("inquiry-reply", { status: "new-inquiry" })).toEqual({
    advanceTo: "responded",
    followUp: { at: "2026-11-28", note: "Follow up on the inquiry reply" },
  });
});

test("the booking welcome settles an earlier stage's follow-up, never one set by hand", () => {
  expect(
    plan("booking-welcome", { status: "proposal-sent", followUpAt: "2026-12-01", followUpNote: "Follow up on the proposal" }),
  ).toEqual({ advanceTo: "contract-signed", clearFollowUp: true });
  expect(
    plan("booking-welcome", { status: "booked", followUpAt: "2026-12-01", followUpNote: "Send the recap and proposal" })
      .clearFollowUp,
  ).toBe(true);
  expect(
    plan("booking-welcome", { status: "booked", followUpAt: "2026-12-01", followUpNote: "Ask about the album" }).clearFollowUp,
  ).toBeUndefined();
  expect(plan("booking-welcome", { status: "booked" }).clearFollowUp).toBeUndefined();
  // A later stage's follow-up (the questionnaire's) isn't one it settles.
  expect(
    plan("booking-welcome", { status: "planning", followUpAt: "2026-12-01", followUpNote: "Check the questionnaire came back" })
      .clearFollowUp,
  ).toBeUndefined();
});

test("a status only moves forward, and a closed project stays closed", () => {
  expect(plan("inquiry-reply", { status: "proposal-sent" }).advanceTo).toBeUndefined();
  expect(plan("proposal", { status: "lost" })).toEqual({
    followUp: { at: "2026-12-01", note: "Follow up on the proposal" },
  });
});

test("a proposal holds the date for the service's hold days, once", () => {
  expect(plan("discovery-recap", { status: "in-conversation" }, 7)).toEqual({
    advanceTo: "proposal-sent",
    hold: "2026-12-02",
    followUp: { at: "2026-12-01", note: "Follow up on the proposal" },
  });
  // A hold that's running is left alone, and none starts without hold days or
  // once the date is being reserved.
  expect(plan("proposal", { status: "proposal-sent", holdUntil: "2026-11-30" }, 7).hold).toBeUndefined();
  expect(plan("proposal", { status: "in-conversation" }).hold).toBeUndefined();
  expect(plan("proposal", { status: "booked" }, 7).hold).toBeUndefined();
  // An expired hold starts again.
  expect(plan("proposal", { status: "proposal-sent", holdUntil: "2026-11-20" }, 7).hold).toBe("2026-12-02");
});

test("the hold a template names is the running one, or the one sending would start", () => {
  expect(heldUntil({ status: "proposal-sent", holdUntil: "2026-12-10" }, 7, TODAY)).toEqual({
    until: "2026-12-10",
    running: true,
  });
  expect(heldUntil({ status: "in-conversation" }, 7, TODAY)).toEqual({ until: "2026-12-02", running: false });
  expect(heldUntil({ status: "in-conversation" }, undefined, TODAY)).toBeUndefined();
  expect(heldUntil({ status: "contract-signed", holdUntil: "2026-12-10" }, 7, TODAY)).toBeUndefined();
});

test("an email names only a hold that's running or that sending it starts", () => {
  const at = (id: string, project: Parameters<typeof planSendEffects>[1]) =>
    holdUntilFor(template(id), project, { today: TODAY, holdDays: 7 });
  // A proposal starts one when none is running.
  expect(at("proposal", { status: "in-conversation" })).toBe("2026-12-02");
  // The follow-up starts none, so it names only a running one.
  expect(at("proposal-follow-up", { status: "proposal-sent", holdUntil: "2026-12-10" })).toBe("2026-12-10");
  expect(at("proposal-follow-up", { status: "proposal-sent", holdUntil: "2026-11-08" })).toBeUndefined();
  expect(at("inquiry-reply", { status: "new-inquiry" })).toBeUndefined();
  // Once the date is being reserved, no hold is named at all.
  expect(at("payment-reminder", { status: "booked", holdUntil: "2026-12-10" })).toBeUndefined();
});

test("a 'no' email closes the project and sets nothing else", () => {
  expect(plan("not-available", { status: "new-inquiry" })).toEqual({ closeAs: "archived" });
  expect(plan("booked-elsewhere", { status: "proposal-sent", holdUntil: "2026-12-10" }, 7)).toEqual({
    closeAs: "declined",
  });
  expect(plan("not-available", { status: "archived" })).toEqual({});
});

test("the review request sets the anniversary email 11 months after the event", () => {
  expect(plan("review-request", { status: "delivered", eventDate: "2026-10-03" }).followUp).toEqual({
    at: "2027-09-03",
    note: "Anniversary email",
  });
  // Long past, or a date that isn't a calendar day: no follow-up.
  expect(plan("review-request", { status: "delivered", eventDate: "2024-05-01" }).followUp).toBeUndefined();
  expect(plan("review-request", { status: "delivered", eventDate: "next spring" }).followUp).toBeUndefined();
});

test("templates move projects to real statuses, use only known tokens, and attach nothing", () => {
  const statuses = new Set<string>(CLIENT_STATUS_OPTIONS.map((o) => o.value));
  const tokens = new Set<string>(EMAIL_TOKENS);
  for (const t of EMAIL_TEMPLATES) {
    if (t.advancesTo) expect(statuses.has(t.advancesTo), t.id).toBe(true);
    if (t.closesAs) expect(["archived", "lost", "declined"], t.id).toContain(t.closesAs);
    expect(t.advancesTo && t.closesAs, t.id).toBeFalsy();
    for (const [, name] of `${t.subject}\n${t.body}`.matchAll(/\{\{(\w+)\}\}/g)) {
      expect(tokens.has(name), `${t.id} uses {{${name}}}`).toBe(true);
    }
    expect(`${t.subject} ${t.body}`, t.id).not.toMatch(/\battach/i);
  }
  expect(EMAIL_TEMPLATES.map((t) => t.id)).not.toContain("hold-the-date");
});

test("the proposal emails carry the real links rather than placeholders for them", () => {
  for (const id of ["discovery-recap", "proposal"]) {
    const body = template(id).body;
    for (const token of ["proposalUrl", "sampleGalleryUrl", "retainerPercent", "holdUntil"]) {
      expect(body, `${id} names {{${token}}}`).toContain(`{{${token}}}`);
    }
  }
  expect(template("contract-deposit").body).toContain("{{contractUrl}}");
  expect(template("contract-deposit").body).toContain("{{invoiceUrl}}");
  expect(template("discovery-invite").body).toContain("{{discoveryCallUrl}}");
  expect(template("review-request").body).toContain("{{reviewUrl}}");
});

test("every template says, without a project, what sending it does", () => {
  // The Content page lists these beside each template.
  const expected: [string, string][] = [
    ["inquiry-reply","Sending this moves the project forward to Responded and sets a follow-up 3 days later (“Follow up on the inquiry reply”)."],
    ["not-available","Sending this closes the project as Archived and clears its follow-up and date hold."],
    ["discovery-invite","Sending this moves the project forward to Responded and sets a follow-up 3 days later (“Follow up on the call invite”)."],
    ["discovery-recap","Sending this moves the project forward to Proposal sent, holds the date for the service's hold days and sets a follow-up 6 days later (“Follow up on the proposal”)."],
    ["proposal","Sending this moves the project forward to Proposal sent, holds the date for the service's hold days and sets a follow-up 6 days later (“Follow up on the proposal”)."],
    ["proposal-follow-up","Sending this sets a follow-up 7 days later (“Last check-in on the proposal”)."],
    ["contract-deposit","Sending this moves the project forward to Booked and sets a follow-up 3 days later (“Check the agreement and retainer came in”)."],
    ["payment-reminder","Sending this leaves the project as it is."],
    ["booking-welcome","Sending this moves the project forward to Contract signed and clears a follow-up an earlier stage set (not one you set yourself)."],
    ["planning-kickoff","Sending this moves the project forward to Planning and sets a follow-up 7 days later (“Check the questionnaire came back”)."],
    ["questionnaire-reminder","Sending this sets a follow-up 5 days later (“Check the questionnaire came back”)."],
    ["timeline-details","Sending this moves the project forward to Scheduled."],
    ["week-of","Sending this moves the project forward to Scheduled."],
    ["post-shoot-thank-you","Sending this moves the project forward to Editing."],
    ["sneak-peek","Sending this moves the project forward to Editing."],
    ["gallery-delivery","Sending this moves the project forward to Delivered."],
    ["prints-albums","Sending this leaves the project as it is."],
    ["review-request","Sending this moves the project forward to Complete and sets a follow-up for 11 months after the event, if that's still ahead (“Anniversary email”)."],
    ["referral-ask","Sending this leaves the project as it is."],
    ["anniversary","Sending this leaves the project as it is."],
    ["re-engagement","Sending this sets a follow-up 7 days later (“Last check-in, then close the lead”)."],
    ["booked-elsewhere","Sending this closes the project as Declined / booked elsewhere and clears its follow-up and date hold."],
  ];
  expect(EMAIL_TEMPLATES.map((t) => [t.id, templateEffectsLine(t)])).toEqual(expected);
  for (const [id, line] of expected) {
    expect(line.endsWith("."), id).toBe(true);
    expect(line, id).not.toContain("\u2014");
  }
});

test("a template's line follows the same rules as a send's plan", () => {
  // One day, and a close that ignores everything else it carries.
  expect(templateEffectsLine({ followUp: { days: 1, note: "Check in" } })).toBe(
    "Sending this sets a follow-up 1 day later (“Check in”).",
  );
  expect(templateEffectsLine({ closesAs: "lost", followUp: { days: 3, note: "x" }, holdsDate: true })).toBe(
    "Sending this closes the project as Lost and clears its follow-up and date hold.",
  );
  // Clearing an earlier follow-up only comes with a move forward, and not
  // with a follow-up of its own, which replaces the old one.
  expect(templateEffectsLine({ settlesFollowUp: true })).toBe("Sending this leaves the project as it is.");
  expect(
    templateEffectsLine({ advancesTo: "planning", settlesFollowUp: true, followUp: { days: 3, note: "Check" } }),
  ).toBe("Sending this moves the project forward to Planning and sets a follow-up 3 days later (“Check”).");
  expect(templateEffectsLine({ followUp: { monthsAfterEvent: 1, note: "Hello" } })).toBe(
    "Sending this sets a follow-up for 1 month after the event, if that's still ahead (“Hello”).",
  );
});

test("a send's plan reads as Compose says it before sending", () => {
  expect(planEffectsLine()).toBe("");
  expect(planEffectsLine({})).toBe("");
  expect(planEffectsLine({ advanceTo: "responded", followUp: { at: "2026-12-01", note: "x" } })).toBe(
    "Sending this moves the project to Responded and sets a follow-up for December 1, 2026.",
  );
  expect(planEffectsLine({ closeAs: "archived" })).toBe("Sending this closes the project as Archived.");
  expect(planEffectsLine({ hold: "2026-12-05", clearFollowUp: true })).toBe(
    "Sending this holds the date until December 5, 2026 and clears the follow-up it settles.",
  );
});

// A line holding only an optional token is left out when the project has
// nothing for it, with the blank line around it; any other empty token stays
// visible to fill in.
test("an optional line with no value is left out, and any other empty token stays to fill in", () => {
  const body = "Hi {{firstName}},\n\nThe proposal: {{proposalUrl}}\n\n{{questionnaireNudge}}\n\nJulian";
  expect(fillTemplate(body, { firstName: "Avery" })).toBe("Hi Avery,\n\nThe proposal: [proposalUrl]\n\nJulian");
  expect(fillTemplate(body, { firstName: "Avery", questionnaireNudge: "Fill it in: https://x.com/q" })).toBe(
    "Hi Avery,\n\nThe proposal: [proposalUrl]\n\nFill it in: https://x.com/q\n\nJulian",
  );
  // How to pay sits right under the invoice line, with no blank line around it.
  const pay = "2. Pay: {{invoiceUrl}}\n{{paymentInstructions}}\n\nThanks";
  expect(fillTemplate(pay, { invoiceUrl: "https://pay" })).toBe("2. Pay: https://pay\n\nThanks");
  expect(fillTemplate(pay, { invoiceUrl: "https://pay", paymentInstructions: "Zelle to me." })).toBe(
    "2. Pay: https://pay\nZelle to me.\n\nThanks",
  );
  // A blank value counts as none.
  expect(fillTemplate("{{questionnaireNudge}}", { questionnaireNudge: "  " })).toBe("");
});

test("every email before the shoot asks for the questionnaire while it isn't back, on a line of its own", () => {
  const optional = new Set<string>(OPTIONAL_TOKENS);
  for (const t of EMAIL_TEMPLATES) {
    // Optional tokens only ever stand alone on a line.
    for (const line of t.body.split("\n")) {
      for (const [, name] of line.matchAll(/\{\{(\w+)\}\}/g)) {
        if (optional.has(name)) expect(line.trim(), `${t.id}: {{${name}}} alone on its line`).toBe(`{{${name}}}`);
      }
    }
    const beforeShoot = CLIENT_STATUS_FLOW.includes(t.stage as never) && statusRank(t.stage) < statusRank("shot");
    const carriesLink = t.body.includes("{{questionnaireUrl}}");
    const nudges = t.body.includes("{{questionnaireNudge}}");
    if (beforeShoot && !t.closesAs && !carriesLink) expect(nudges, `${t.id} asks for the questionnaire`).toBe(true);
    else expect(nudges, `${t.id} has no questionnaire line`).toBe(false);
  }
  expect(template("booking-welcome").body).not.toMatch(/Closer to the date/);
});

test("the calls, the review and the gallery are links where an email offers them", () => {
  for (const id of ["discovery-recap", "proposal-follow-up", "re-engagement"]) {
    expect(template(id).body, id).toContain("{{discoveryCallUrl}}");
  }
  for (const id of ["planning-kickoff", "questionnaire-reminder", "timeline-details"]) {
    expect(template(id).body, id).toContain("{{planningCallUrl}}");
  }
  expect(template("gallery-delivery").body).toContain("{{reviewUrl}}");
  expect(template("re-engagement").body).not.toContain("{{bookingUrl}}");
  // Sent for every service: no congratulations.
  expect(template("inquiry-reply").body).not.toMatch(/congratulations/i);
  expect(template("booked-elsewhere").body).not.toMatch(/congratulations/i);
});

test("anything in brackets is named before an email can go", () => {
  expect(unfilledParts("Hi [firstName], your [2 or 3 of their priorities]. See [here](https://x.com).")).toEqual([
    "[firstName]",
    "[2 or 3 of their priorities]",
    "[here]",
  ]);
  expect(unfilledParts("Same [venue] twice: [venue].")).toEqual(["[venue]"]);
  expect(unfilledParts("Nothing to fill in.")).toEqual([]);
  // A bracket split across lines isn't a placeholder.
  expect(unfilledParts("[not\nthis]")).toEqual([]);
});

test("the questionnaire is asked for before the shoot, while it isn't back", () => {
  const today = TODAY;
  const ask = (p: Parameters<typeof questionnaireOutstanding>[0], hasQuestionnaire = true) =>
    questionnaireOutstanding(p, { today, hasQuestionnaire });
  expect(ask({ status: "new-inquiry" })).toBe(true);
  expect(ask({ status: "booked", eventDate: "2027-06-05" })).toBe(true);
  // A date written as text with no single day still asks.
  expect(ask({ status: "planning", eventDate: "Fall 2027" })).toBe(true);
  expect(ask({ status: "planning", questionnaireSnapshot: '{"a":1}' })).toBe(false);
  expect(ask({ status: "planning" }, false)).toBe(false);
  expect(ask({ status: "lost" })).toBe(false);
  expect(ask({ status: "archived" })).toBe(false);
  expect(ask({ status: "editing" })).toBe(false);
  // The shoot day passed, whatever the status says.
  expect(ask({ status: "scheduled", eventDate: "2026-11-20" })).toBe(false);
  expect(ask({ status: "scheduled", eventDate: TODAY })).toBe(true);
  expect(preparingForShoot({ status: "planning", reserving: false, shot: true }, today)).toBe(false);
});

test("a proposal links Studio's sample gallery, else the service's portfolio page when it shows work", () => {
  // Only whether a page has images or videos matters here.
  const withImages = { slug: "weddings" as const, images: [{ src: "/a.jpg", alt: "" }] as never[] };
  expect(sampleGalleryFor({ slug: "weddings", sampleGalleryUrl: " https://pic.example.com/w " }, [withImages])).toBe(
    "https://pic.example.com/w",
  );
  expect(sampleGalleryFor({ slug: "weddings" }, [withImages])).toBe(`${SITE_URL}/portfolio/weddings`);
  // A page of placeholders, a hidden portfolio, another service's: none.
  expect(sampleGalleryFor({ slug: "weddings" }, [{ slug: "weddings", images: [] }])).toBeUndefined();
  expect(sampleGalleryFor({ slug: "weddings" }, [{ ...withImages, hidden: true }])).toBeUndefined();
  expect(sampleGalleryFor({ slug: "newborn" }, [withImages])).toBeUndefined();
  // A portfolio that names its service, and a film archive.
  expect(
    sampleGalleryFor({ slug: "wedding-films" }, [{ slug: "films", serviceSlug: "wedding-films", images: [], videos: [{}] } as never]),
  ).toBe(`${SITE_URL}/portfolio/films`);
  expect(sampleGalleryFor(undefined, [withImages])).toBeUndefined();
});
