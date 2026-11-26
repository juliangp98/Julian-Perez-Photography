import type { APIRequestContext, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, hasTestStore } from "./support/fixtures";
import { addMessage, patchProject, readProject, testStore } from "./support/test-store";
import { stagesFor } from "../../src/lib/client-status";
import {
  ownerNextStep,
  sentTemplates,
  type NextStepContext,
  type NextStepProject,
} from "../../src/lib/next-step";
import { formatHumanDate, shiftDay, studioToday } from "../../src/lib/field-format";
import { openInvoice } from "../../src/lib/project-links";
import { signedWebhook } from "./support/webhook-sign";

// The admin project page (/admin/projects/[id]): a header with the facts, the
// stage tracker, the one next step, the status and the follow-up, over five
// tabs (Overview, Call, Messages, Links & files, Details). The stage and
// next-step rules (src/lib/client-status.ts, src/lib/next-step.ts) are checked
// directly; the page against the test store.

const TODAY = "2026-11-25";
const ctx = (over: Partial<NextStepContext> = {}): NextStepContext => ({
  today: TODAY,
  sent: new Map(),
  questionnaire: true,
  ...over,
});
const next = (p: Partial<NextStepProject>, c = ctx()) =>
  ownerNextStep({ id: "p", email: "client@example.com", clientName: "Avery Example", ...p }, c);
const compose = (template: string) => `/admin/projects/p?compose=${template}#compose`;
const tab = (name: string) => `/admin/projects/p?tab=${name}`;
// Templates sent, each "<id>" (on November 1) or "<id>@<day>".
const sent = (...ids: string[]) =>
  ctx({ sent: new Map(ids.map((id) => [id.split("@")[0], id.split("@")[1] ?? "2026-11-01"])) });
const own = (type: string, more: Record<string, string> = {}): Record<string, string> => ({
  type,
  uploadedBy: "julian",
  ...more,
});

test("stages: ten in all, passing over a call and a proposal the project never had", () => {
  const fresh = stagesFor({ status: "new-inquiry" });
  expect(fresh.stages).toHaveLength(10);
  expect(fresh).toMatchObject({ step: 1, closed: false });
  expect(fresh.stages[0]).toMatchObject({ label: "Inquiry", state: "current" });
  // Still to come, the call and the proposal stay on the path.
  expect(stagesFor({ status: "responded" }).stages).toHaveLength(10);

  // Booked straight from the inquiry: no call, no proposal.
  const direct = stagesFor({ status: "booked", statusHistory: [{ status: "new-inquiry" }, { status: "booked" }] });
  expect(direct.stages.map((s) => s.label)).toEqual([
    "Inquiry",
    "Reserving your date",
    "Booked",
    "Planning",
    "Shoot",
    "Editing",
    "Delivered",
    "Complete",
  ]);
  expect(direct.step).toBe(2);

  // A held call and a proposal link count, even when the status jumped them.
  const took = stagesFor({
    status: "booked",
    statusHistory: [{ status: "new-inquiry" }, { status: "booked" }],
    calls: { discovery: { heldAt: "2026-11-01T15:00:00Z" } },
    documents: [{ type: "proposal" }],
  });
  expect(took.stages).toHaveLength(10);
  expect(took.step).toBe(4);

  // Shot and editing are both the Editing stage.
  const shot = stagesFor({ status: "shot" });
  expect(shot.stages[shot.step - 1].label).toBe("Editing");

  // A closed project shows where it stopped.
  const lost = stagesFor({
    status: "lost",
    statusHistory: [
      { status: "new-inquiry" },
      { status: "in-conversation" },
      { status: "proposal-sent" },
      { status: "lost" },
    ],
  });
  expect(lost).toMatchObject({ closed: true, step: 3 });
  expect(lost.stages[2]).toMatchObject({ label: "Proposal", state: "current" });
});

test("next step: one per stage, from the inquiry to the referral", () => {
  expect(next({ status: "new-inquiry" })).toMatchObject({
    title: "Reply to the inquiry",
    action: { href: compose("inquiry-reply") },
  });
  // Answered without the inquiry reply, or marked handled on Today: past replying to.
  expect(next({ status: "new-inquiry", lastOutAt: "2026-11-24T15:00:00Z" }).title).toBe(
    "Invite them to a discovery call",
  );
  expect(next({ status: "new-inquiry", todayDismissed: { inquiry: "handled" } }).title).toBe(
    "Invite them to a discovery call",
  );

  // Inviting to the call, holding it, then saving what was said.
  expect(next({ status: "responded" }).action?.href).toBe(compose("discovery-invite"));
  expect(next({ status: "responded" }, sent("discovery-invite"))).toMatchObject({
    title: "Hold the discovery call",
    action: { href: tab("call") },
  });
  // The inquiry reply carries the call link, so no second invite.
  expect(next({ status: "responded" }, sent("inquiry-reply")).title).toBe("Hold the discovery call");
  expect(next({ status: "responded", calls: { discovery: { notes: "Loves the vineyard." } } }).title).toBe(
    "Save the call summary",
  );

  // The proposal: its link first, then the email that fits.
  expect(next({ status: "in-conversation" })).toMatchObject({
    title: "Add the proposal link",
    action: { href: tab("links") },
  });
  const proposal = [own("proposal")];
  expect(
    next({ status: "in-conversation", documents: proposal, calls: { discovery: { heldAt: "2026-11-20T15:00:00Z" } } })
      .action?.href,
  ).toBe(compose("discovery-recap"));
  // In conversation with no call held (moved there by hand): the proposal email.
  expect(next({ status: "in-conversation", documents: proposal }).action?.href).toBe(compose("proposal"));

  // Waiting on an answer, with what to do meanwhile.
  const proposed = sent("proposal");
  expect(next({ status: "proposal-sent" }, proposed)).toMatchObject({
    title: "Waiting on Avery's answer",
    action: { href: tab("links") },
  });
  // Set to Proposal sent by hand, or the email bounced: it hasn't reached them.
  expect(next({ status: "proposal-sent", documents: proposal }).action?.href).toBe(compose("proposal"));
  expect(next({ status: "proposal-sent", followUpAt: TODAY }, proposed).action?.href).toBe(
    compose("proposal-follow-up"),
  );
  expect(next({ status: "proposal-sent", holdUntil: "2026-11-20" }, proposed)).toMatchObject({
    title: "The date hold ended",
    detail: "It ran until November 20, 2026. Follow up, or let the date go.",
  });
  expect(
    next({ status: "proposal-sent", documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })] }).action
      ?.href,
  ).toBe(compose("contract-deposit"));
  // A yes after the hold ran out still gets the contract. A follow-up sent on
  // or after the hold's last day, or the Today row marked handled or snoozed,
  // settles it; the proposal's own follow-up date doesn't.
  expect(
    next({
      status: "proposal-sent",
      holdUntil: "2026-11-20",
      documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })],
    }).action?.href,
  ).toBe(compose("contract-deposit"));
  expect(next({ status: "proposal-sent", holdUntil: "2026-11-20", followUpAt: "2026-11-27" }, proposed).title).toBe(
    "The date hold ended",
  );
  expect(
    next({ status: "proposal-sent", holdUntil: "2026-11-20" }, sent("proposal", "proposal-follow-up@2026-11-22")).title,
  ).toBe("Waiting on Avery's answer");
  expect(
    next({ status: "proposal-sent", holdUntil: "2026-11-20" }, sent("proposal", "proposal-follow-up@2026-11-10")).title,
  ).toBe("The date hold ended");
  expect(
    next({ status: "proposal-sent", holdUntil: "2026-11-20" }, sent("proposal", "proposal-follow-up@2026-11-20")).title,
  ).toBe("Waiting on Avery's answer");
  expect(
    next({ status: "proposal-sent", holdUntil: "2026-11-20", todayDismissed: { "hold:2026-11-20": "handled" } }, proposed)
      .title,
  ).toBe("Waiting on Avery's answer");
  expect(
    next({ status: "proposal-sent", holdUntil: "2026-11-20", todayDismissed: { "hold:2026-11-20": "2026-11-28" } }, proposed)
      .title,
  ).toBe("Waiting on Avery's answer");
  expect(
    next({ status: "proposal-sent", holdUntil: "2026-11-20", todayDismissed: { "hold:2026-11-20": "2026-11-24" } }, proposed)
      .title,
  ).toBe("The date hold ended");

  // Reserving the date: the paperwork, the retainer, then the welcome.
  expect(next({ status: "booked" }).title).toBe("Add the Square contract and invoice");
  const deposit = sent("contract-deposit");
  // Set to Booked by hand, the links added: the email carrying them comes first.
  expect(next({ status: "booked", documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })] }).action?.href).toBe(
    compose("contract-deposit"),
  );
  expect(
    next({ status: "booked", documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })] }, deposit),
  ).toMatchObject({
    title: "Waiting on the signed contract and retainer",
    detail: "It's due December 1, 2026. Mark the invoice paid when it comes in.",
  });
  expect(
    next({ status: "booked", documents: [own("contract"), own("invoice", { dueAt: "2026-11-20" })] }, deposit),
  ).toMatchObject({
    title: "The retainer is overdue",
    action: { href: compose("payment-reminder") },
  });
  // With a balance invoice added too, the retainer is the one named: it's due first.
  expect(
    next(
      {
        status: "booked",
        documents: [own("contract"), own("invoice", { dueAt: "2026-11-20" }), own("invoice", { dueAt: "2027-05-01" })],
      },
      deposit,
    ).detail,
  ).toBe("It was due November 20, 2026.");
  expect(
    next({ status: "booked", documents: [own("contract"), own("invoice", { paidAt: "2026-11-21" })] }).action?.href,
  ).toBe(compose("booking-welcome"));
  // The retainer paid, a balance invoice still open: that's for delivery.
  expect(
    next({
      status: "booked",
      documents: [
        own("contract"),
        own("invoice", { dueAt: "2026-11-10", paidAt: "2026-11-09" }),
        own("invoice", { dueAt: "2027-05-01" }),
      ],
    }).action?.href,
  ).toBe(compose("booking-welcome"));

  // Set to Contract signed by hand: the welcome first. Then planning starts
  // within two months of the shoot.
  expect(next({ status: "contract-signed" }).action?.href).toBe(compose("booking-welcome"));
  const welcomed = sent("booking-welcome");
  expect(next({ status: "contract-signed" }, welcomed).action?.href).toBe(compose("planning-kickoff"));
  expect(next({ status: "contract-signed", eventDate: "2027-01-10" }, welcomed).action?.href).toBe(
    compose("planning-kickoff"),
  );
  expect(next({ status: "contract-signed", eventDate: "2027-06-12" }, welcomed)).toEqual({
    title: "Booked",
    detail: "Planning starts about two months before the shoot, around April 13, 2027. Nothing to send yet.",
  });

  // Planning: the questionnaire, then the timeline.
  expect(next({ status: "planning" })).toMatchObject({
    title: "Waiting on the questionnaire",
    action: { href: compose("questionnaire-reminder") },
  });
  // The timeline link first, then the email that carries it.
  expect(next({ status: "planning", questionnaireSnapshot: "{}" })).toMatchObject({
    title: "Add the timeline",
    action: { href: tab("links") },
  });
  const timeline = [own("timeline")];
  expect(next({ status: "planning", questionnaireSnapshot: "{}", documents: timeline }).action?.href).toBe(
    compose("timeline-details"),
  );
  expect(next({ status: "planning", documents: timeline }, ctx({ questionnaire: false })).action?.href).toBe(
    compose("timeline-details"),
  );
  // A timeline the client uploaded isn't the one the email sends.
  expect(next({ status: "planning", questionnaireSnapshot: "{}", documents: [{ type: "timeline", uploadedBy: "client" }] }).title).toBe(
    "Add the timeline",
  );

  // The week of the shoot, and after it.
  expect(next({ status: "scheduled", eventDate: "2026-11-28" })).toMatchObject({
    title: "Send the week-of email",
    detail: "The shoot is in 3 days.",
  });
  expect(next({ status: "scheduled", eventDate: "2026-11-28" }, sent("week-of"))).toEqual({
    title: "Shoot in 3 days",
    detail: "November 28, 2026. Nothing to send yet.",
  });
  expect(next({ status: "scheduled", eventDate: "2026-12-15" }).title).toBe("Shoot in 20 days");
  expect(next({ status: "scheduled", eventDate: "2026-11-22" }).action?.href).toBe(compose("post-shoot-thank-you"));
  expect(next({ status: "scheduled", eventDate: "Fall 2026" }).title).toBe("Set the shoot date");
  expect(next({ status: "shot" }).action?.href).toBe(compose("post-shoot-thank-you"));

  // Editing: highlights, the sneak peek, then the gallery.
  expect(next({ status: "editing" }).title).toBe("Add the highlights or the gallery");
  expect(next({ status: "editing", documents: [own("highlights")] }).action?.href).toBe(compose("sneak-peek"));
  expect(next({ status: "editing", documents: [own("highlights")] }, sent("sneak-peek")).title).toBe("Add the gallery");
  expect(next({ status: "editing", eventDate: "2026-11-01" }, ctx({ turnaroundDays: 30 })).detail).toBe(
    "The gallery is due December 1, 2026. Adding a link emails no one.",
  );

  // Delivered: the gallery email, the final invoice, then a review.
  expect(next({ status: "delivered" }).title).toBe("Add the gallery");
  expect(next({ status: "delivered", documents: [own("gallery")] }).action?.href).toBe(compose("gallery-delivery"));
  expect(
    next({ status: "delivered", documents: [own("gallery"), own("invoice", { dueAt: "2026-12-10" })] }, sent("gallery-delivery"))
      .title,
  ).toBe("Waiting on the final invoice");
  expect(next({ status: "delivered", documents: [own("gallery")] }, sent("gallery-delivery")).action?.href).toBe(
    compose("review-request"),
  );
  // Asked for already, while the status hasn't moved.
  expect(next({ status: "delivered", documents: [own("gallery")] }, sent("gallery-delivery", "review-request"))).toEqual({
    title: "Review asked for",
    detail: "Set the status to Complete once it's in.",
  });
  expect(next({ status: "complete" }).action?.href).toBe(compose("referral-ask"));
  expect(next({ status: "complete" }, sent("referral-ask")).title).toBe("All done");
});

test("next step: a closed project, a missing email, then an unanswered client come first", () => {
  const wrote = { lastInAt: "2026-11-23T15:00:00Z", lastOutAt: "2026-11-20T15:00:00Z" };
  expect(next({ status: "proposal-sent", ...wrote })).toEqual({
    title: "Answer Avery",
    detail: "Avery wrote 2 days ago.",
    action: { label: "Write a reply", href: "/admin/projects/p?tab=messages#compose" },
  });
  // A new inquiry's first answer is the inquiry reply; once anything has
  // gone to them, Compose opens on no template.
  expect(next({ status: "new-inquiry", lastInAt: wrote.lastInAt }).action).toEqual({
    label: "Draft a reply",
    href: compose("inquiry-reply"),
  });
  expect(next({ status: "new-inquiry", ...wrote }).action?.href).toBe("/admin/projects/p?tab=messages#compose");
  // A message marked handled, or snoozed past today, on the Today list needs no answer here.
  const key = `reply:${wrote.lastInAt}`;
  const proposed = sent("proposal");
  expect(next({ status: "proposal-sent", ...wrote, todayDismissed: { [key]: "handled" } }, proposed).title).toBe(
    "Waiting on Avery's answer",
  );
  expect(next({ status: "proposal-sent", ...wrote, todayDismissed: { [key]: "2026-11-28" } }, proposed).title).toBe(
    "Waiting on Avery's answer",
  );
  expect(next({ status: "proposal-sent", ...wrote, todayDismissed: { [key]: "2026-11-24" } }, proposed).title).toBe(
    "Answer Avery",
  );
  // A new inquiry whose message was marked handled is past replying to; one
  // only snoozed on Today still wants the reply.
  expect(
    next({ status: "new-inquiry", lastInAt: wrote.lastInAt, todayDismissed: { [key]: "handled" } }).title,
  ).toBe("Invite them to a discovery call");
  expect(next({ status: "new-inquiry", todayDismissed: { inquiry: "2026-11-28" } }).title).toBe("Reply to the inquiry");
  // A lost lead writing back is answered; another closed project stays closed.
  expect(next({ status: "lost", ...wrote }).title).toBe("Answer Avery");
  // A message from before it was closed had its answer in the closing.
  expect(
    next({ status: "lost", ...wrote, statusHistory: [{ status: "lost", changedAt: "2026-11-24T15:00:00Z" }] }).title,
  ).toBe("Closed as lost");
  expect(
    next({ status: "lost", ...wrote, statusHistory: [{ status: "lost", changedAt: "2026-11-22T15:00:00Z" }] }).title,
  ).toBe("Answer Avery");
  // A note added after the close isn't the close.
  expect(
    next({
      status: "lost",
      ...wrote,
      statusHistory: [
        { status: "lost", changedAt: "2026-11-22T15:00:00Z" },
        { kind: "note", status: "lost", changedAt: "2026-11-24T15:00:00Z" },
      ],
    }).title,
  ).toBe("Answer Avery");
  expect(next({ status: "archived", ...wrote }).title).toBe("Closed");
  expect(next({ status: "booked", email: "", ...wrote }).title).toBe("Add the client's email");
  expect(
    next({ status: "proposal-sent", lastInAt: "2026-11-20T15:00:00Z", lastOutAt: "2026-11-23T15:00:00Z" }, proposed).title,
  ).toBe("Waiting on Avery's answer");
  expect(next({ status: "booked", email: "" })).toMatchObject({
    title: "Add the client's email",
    action: { href: tab("details") },
  });
  expect(next({ status: "lost" }).action?.href).toBe(compose("re-engagement"));
  expect(next({ status: "lost" }, sent("re-engagement"))).toEqual({
    title: "Closed as lost",
    detail: "A check-in went out. If they write back, it shows here.",
  });
  expect(next({ status: "archived" })).toEqual({
    title: "Closed",
    detail: "Nothing left to do. Change the status to reopen it.",
  });
  // A contract the client uploaded isn't the Square one.
  expect(next({ status: "booked", documents: [{ type: "contract", uploadedBy: "client" }, own("invoice")] }).title).toBe(
    "Add the Square contract and invoice",
  );
});

test("next step: a stage email can be noted as sent another way, and a message as handled", () => {
  // The step names the template it sends, unless it's one that repeats.
  expect(next({ status: "contract-signed" }).once).toBe("booking-welcome");
  expect(next({ status: "proposal-sent", followUpAt: TODAY }, sent("proposal")).once).toBeUndefined();
  expect(next({ status: "proposal-sent" }, sent("proposal")).once).toBeUndefined();
  // A client's message waiting on an answer is settled by its Today row, not as an email sent.
  const reply = next({ status: "new-inquiry", lastInAt: "2026-11-23T15:00:00Z" });
  expect(reply).toMatchObject({ title: "Answer Avery", handled: "reply:2026-11-23T15:00:00Z" });
  expect(reply.once).toBeUndefined();
  // Noted as sent counts even when a recorded email of that template bounced.
  expect(
    sentTemplates([{ direction: "out", template: "booking-welcome", wentOut: false }], [
      { note: "Booking welcome noted as sent" },
    ]).has("booking-welcome"),
  ).toBe(true);
});

test("the invoice a client pays next: an overdue one, else an undated one (due now), else the one due first", () => {
  const docs = [
    own("invoice", { id: "balance", dueAt: "2027-05-01" }),
    own("invoice", { id: "retainer" }),
    own("invoice", { id: "prints", dueAt: "2026-12-10" }),
  ];
  expect(openInvoice({ documents: docs }, TODAY)?.id).toBe("retainer");
  expect(openInvoice({ documents: docs.filter((d) => d.id !== "retainer") }, TODAY)?.id).toBe("prints");
  expect(openInvoice({ documents: [...docs, own("invoice", { id: "late", dueAt: "2026-11-20" })] }, TODAY)?.id).toBe("late");
  expect(openInvoice({ documents: [own("invoice", { id: "paid", paidAt: "2026-11-01" })] }, TODAY)).toBeUndefined();
  // The booked step reads the same one: no due line for a retainer due now.
  expect(
    next(
      { status: "booked", documents: [own("contract"), own("invoice"), own("invoice", { dueAt: "2027-05-01" })] },
      sent("contract-deposit"),
    ),
  ).toMatchObject({ title: "Waiting on the signed contract and retainer", detail: "Mark the invoice paid when it comes in." });
});

test("sent templates: recorded ones that went out, and older emails by subject or by the activity log", () => {
  const sentIds = sentTemplates(
    [
      { direction: "out", template: "week-of", subject: "Anything", sentAt: "2026-11-20T15:00:00Z", wentOut: true },
      // A recorded send that bounced doesn't count, nor does its activity note.
      { direction: "out", template: "inquiry-reply", subject: "Your wedding inquiry", wentOut: false },
      // Sent before templates were recorded, with the subject as the template had it.
      { direction: "out", subject: "Your Smith Wedding gallery is ready", wentOut: true },
      { direction: "out", subject: "Re: Your wedding inquiry", wentOut: true },
      { direction: "out", subject: "Would you leave a review?", wentOut: false },
      { direction: "in", subject: "Thanks, you're booked for June 12", wentOut: true },
    ],
    [{ note: "Booking welcome sent" }, { note: "Inquiry reply sent" }, { note: "Updated by admin" }],
  );
  expect([...sentIds.keys()].sort()).toEqual(["booking-welcome", "gallery-delivery", "week-of"]);
  // With the studio day each went out, when the email says.
  expect(sentIds.get("week-of")).toBe("2026-11-20");
  expect(sentIds.get("booking-welcome")).toBe("");
});

// A fresh wedding project for one test.
async function newProject(request: APIRequestContext, tag: string) {
  const email = `e2e-page-${tag}-${Date.now()}@example.com`;
  const res = await request.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Page", serviceType: "weddings", eventDate: "2027-06-12", force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  return { id: id as string, email, page: `/admin/projects/${id}` };
}

// A calendar day as the date field types it.
const typed = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const nextStep = (page: Page) => page.getByRole("region", { name: "Next step" });

test("the header shows the facts, the stage and the next step, which opens Compose", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "header");
  await patchProject(p.id, {
    guest_count: 120,
    payment_method: "zelle",
    locations: [{ label: "Stone Barn", address: "1 Farm Rd" }],
  });

  await page.goto(p.page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByText("Weddings · June 12, 2027 · Stone Barn · 120 guests · Pays by Zelle", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Step 1 of 10: Inquiry", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Stages" }).getByRole("listitem")).toHaveCount(10);
  await expect(nextStep(page)).toContainText("Reply to the inquiry");

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast"])
    .analyze();
  expect(scan.violations).toEqual([]);

  // The next step hands off to Compose, on the Messages tab, on its template.
  await nextStep(page).getByRole("link", { name: "Draft a reply" }).click();
  await expect(page).toHaveURL(/compose=inquiry-reply/);
  await expect(page.getByRole("link", { name: "Messages", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Email template" })).toHaveValue("inquiry-reply");
  await expect(page.getByRole("heading", { name: "Compose email" })).toBeInViewport();
});

test("tabs: each shows its part, and a Compose link with no tab opens Messages", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "tabs");
  const active = () => page.getByRole("navigation", { name: "Project" }).locator('[aria-current="page"]');

  await page.goto(p.page);
  await expect(active()).toHaveText("Overview");
  await expect(page.getByText("No inquiry message on this project.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discovery call" })).toBeVisible();

  await page.goto(`${p.page}?tab=call`);
  await expect(active()).toHaveText("Call");
  await expect(page.getByText("My notes").first()).toBeVisible();

  await page.goto(`${p.page}?tab=messages`);
  await expect(active()).toHaveText("Messages");
  await expect(page.getByRole("heading", { name: "Compose email" })).toBeVisible();

  await page.goto(`${p.page}?tab=links`);
  await expect(active()).toHaveText("Links & files");
  await expect(page.locator("#links").getByText(/Nothing here yet/)).toBeVisible();

  await page.goto(`${p.page}?tab=details`);
  await expect(active()).toHaveText("Details");
  await expect(page.getByRole("group", { name: "Shared with the client" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Private" }).getByLabel("Budget")).toBeVisible();
  // The private notes box is the activity log now, and the status lives in the header.
  await expect(page.getByLabel(/Internal notes/)).toHaveCount(0);
  await expect(page.locator("#a-status")).toHaveCount(0);

  await page.goto(`${p.page}?compose=proposal`);
  await expect(active()).toHaveText("Messages");
  await expect(page.getByRole("combobox", { name: "Email template" })).toHaveValue("proposal");
  await page.goto(`${p.page}?tab=nothing`);
  await expect(active()).toHaveText("Overview");
});

test("status: a pick waits for Save, then moves the tracker; closing asks first and clears the follow-up", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "status");
  await page.goto(p.page);

  // Moving through the list changes nothing until Save.
  await page.locator("#project-status").selectOption("booked");
  await page.locator("#project-status").selectOption("in-conversation");
  expect((await readProject(p.id, "status")).status).toBe("new-inquiry");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByText("Step 2 of 10: Call", { exact: true })).toBeVisible();
  await expect(nextStep(page)).toContainText("Add the proposal link");
  const moved = (await readProject(p.id, "status, status_history")) as {
    status: string;
    status_history: { status?: string; note?: string; changedAt?: string }[];
  };
  expect(moved.status).toBe("in-conversation");
  expect(moved.status_history.at(-1)).toMatchObject({ status: "in-conversation", note: "Updated by admin" });
  expect(moved.status_history.at(-1)?.changedAt).toBeTruthy();

  // Closing asks; saying no leaves it as it was.
  await patchProject(p.id, { follow_up_at: shiftDay(studioToday(), { days: 5 }), follow_up_note: "Check in" });
  await page.reload();
  await page.locator("#project-status").selectOption("lost");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByRole("button", { name: "Save status" })).toBeVisible();
  expect((await readProject(p.id, "status")).status).toBe("in-conversation");
  // Cancel puts the pick back.
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#project-status")).toHaveValue("in-conversation");

  await page.locator("#project-status").selectOption("lost");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Closed at Call", { exact: true })).toBeVisible();
  await expect(page.getByText("None set.")).toBeVisible();
  await expect(nextStep(page)).toContainText("Closed as lost");
  // The activity log lists the moves, newest first.
  await page.goto(`${p.page}?tab=details`);
  const log = page.getByRole("list", { name: "Activity" }).getByRole("listitem");
  await expect(log.nth(0)).toContainText("Lost");
  await expect(log.nth(1)).toContainText("In conversation");
  await expect(log.nth(1)).toContainText("Updated by admin");
  expect(await readProject(p.id, "status, follow_up_at, hold_until")).toEqual({
    status: "lost",
    follow_up_at: null,
    hold_until: null,
  });
});

test("follow-up: set, moved and cleared from the header, and a stale change is refused", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "follow");
  const week = shiftDay(studioToday(), { days: 7 });
  await page.goto(p.page);
  await expect(page.getByText("None set.")).toBeVisible();

  await page.getByRole("button", { name: "Set a follow-up" }).click();
  await page.locator("#follow-up-day").fill(typed(week));
  await page.getByLabel("What for (optional)").fill("Check in about the album");
  await page.getByRole("button", { name: "Save follow-up" }).click();
  await expect(page.getByText(`${formatHumanDate(week)}: Check in about the album`, { exact: true })).toBeVisible();
  expect(await readProject(p.id, "follow_up_at, follow_up_note")).toEqual({
    follow_up_at: week,
    follow_up_note: "Check in about the album",
  });

  // A send in another tab sets a different one; a change made against the
  // old one is refused, and the page shows the new one.
  const sendSet = shiftDay(studioToday(), { days: 6 });
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await patchProject(p.id, { follow_up_at: sendSet, follow_up_note: "Follow up on the proposal" });
  await page.locator("#follow-up-day").fill(typed(shiftDay(studioToday(), { days: 10 })));
  await page.getByRole("button", { name: "Save follow-up" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That follow-up changed since this page loaded." }),
  ).toBeVisible();
  await expect(page.getByText(`${formatHumanDate(sendSet)}: Follow up on the proposal`, { exact: true })).toBeVisible();
  expect((await readProject(p.id, "follow_up_at")).follow_up_at).toBe(sendSet);

  // One set where the page saw none is refused the same way.
  const stale = await adminRequest.post("/api/admin/update", {
    data: { id: p.id, followUp: { at: week, expect: null } },
  });
  expect(stale.status()).toBe(409);

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("None set.")).toBeVisible();
  expect((await readProject(p.id, "follow_up_at")).follow_up_at).toBeNull();
});

test("activity: a note is added and dated, after the notes kept before the log", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "notes");
  const history = (await readProject(p.id, "status_history")).status_history as unknown[];
  await patchProject(p.id, {
    status_history: [
      { kind: "note", from: "internal-notes", status: "new-inquiry", note: "Prefers email over calls" },
      ...history,
    ],
  });

  await page.goto(`${p.page}?tab=details`);
  const log = page.getByRole("list", { name: "Activity" });
  await expect(log.getByRole("listitem").last()).toContainText("Earlier notes");
  await expect(log.getByRole("listitem").last()).toContainText("Prefers email over calls");

  await page.getByLabel(/Add a note/).fill("Called, left a voicemail");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added." })).toBeVisible();
  const first = log.getByRole("listitem").first();
  await expect(first).toContainText("Note");
  await expect(first).toContainText("Called, left a voicemail");
  await expect(first).toContainText(formatHumanDate(studioToday(), { month: "short" }).replace(/, \d{4}$/, ""));

  const saved = (await readProject(p.id, "status, status_history")) as {
    status: string;
    status_history: { kind?: string; note?: string; status?: string; changedAt?: string }[];
  };
  expect(saved.status_history.at(-1)).toMatchObject({
    kind: "note",
    note: "Called, left a voicemail",
    status: saved.status,
  });
  expect(saved.status_history.at(-1)?.changedAt).toBeTruthy();
});

test("a template sent from Compose is recorded, and its step clears", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "weekof");
  const shoot = shiftDay(studioToday(), { days: 3 });
  await patchProject(p.id, { status: "scheduled", event_date: shoot });
  await page.goto(p.page);
  await expect(nextStep(page)).toContainText("Send the week-of email");

  const res = await adminRequest.post("/api/admin/send-email", {
    data: { projectId: p.id, templateId: "week-of", subject: "This week", body: "Hi,\n\nSee you soon.\n\nJulian" },
  });
  expect(res.status()).toBe(200);
  const { data } = await testStore()!
    .from("client_messages")
    .select("template")
    .eq("project_id", p.id);
  expect(data).toEqual([{ template: "week-of" }]);

  await page.reload();
  await expect(nextStep(page)).toContainText("Shoot in 3 days");
});

test("compose: an unsent email survives a tab change and a hand-off elsewhere, and a send starts afresh", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "draft");
  const tabs = page.getByRole("navigation", { name: "Project" });
  const body = page.getByLabel("Email body");
  const template = page.getByRole("combobox", { name: "Email template" });

  await page.goto(`${p.page}?compose=proposal`);
  await body.fill("Hi,\n\nA draft still being written.\n\nJulian");

  // A hand-off to another template opens afresh; Back shows the email again.
  await nextStep(page).getByRole("link", { name: "Draft a reply" }).click();
  await expect(template).toHaveValue("inquiry-reply");
  await expect(body).not.toHaveValue(/A draft still being written/);
  await page.goBack();
  await expect(template).toHaveValue("proposal");
  await expect(body).toHaveValue(/A draft still being written/);

  await tabs.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByText("No inquiry message on this project.")).toBeVisible();

  // Back on Messages, by the tab or by Write email, the email is as it was left.
  await tabs.getByRole("link", { name: "Messages" }).click();
  await expect(template).toHaveValue("proposal");
  await expect(body).toHaveValue(/A draft still being written/);
  await tabs.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByText("No inquiry message on this project.")).toBeVisible();
  await page.getByRole("link", { name: "Write email", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=messages#compose$/);
  await expect(body).toHaveValue(/A draft still being written/);

  // Sent, it's gone: Compose opens afresh.
  await page.getByRole("button", { name: "Send to client" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent to the client." })).toBeVisible();
  await tabs.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByText("No inquiry message on this project.")).toBeVisible();
  await tabs.getByRole("link", { name: "Messages" }).click();
  await expect(template).toHaveValue("");
});

test("the inquiry reply opens with what they wrote and its assessment above Compose", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "inquiry");
  await patchProject(p.id, {
    inquiry_message: "We're planning a fall wedding at a vineyard.",
    ai_results: {
      triage: {
        result: {
          summary: "A fall vineyard wedding.",
          fit: "good",
          fitReason: "",
          urgency: "medium",
          urgencyReason: "",
          keyDetails: [],
        },
        at: new Date().toISOString(),
      },
    },
  });

  await page.goto(p.page);
  await nextStep(page).getByRole("link", { name: "Draft a reply" }).click();
  const panel = page.locator("#compose");
  await expect(panel.getByRole("heading", { name: "Their inquiry" })).toBeVisible();
  await expect(panel.getByText("We're planning a fall wedding at a vineyard.")).toBeVisible();
  await expect(panel.getByText("A fall vineyard wedding.")).toBeVisible();
  // Compose is already open on the reply, so the assessment doesn't offer it again.
  await expect(panel.getByRole("link", { name: "Draft a reply from this" })).toHaveCount(0);
  await expect(page.getByLabel("Extra instructions for the AI draft")).toHaveValue(/A fall vineyard wedding/);
});

test("overview: a checklist toward the shoot, then toward delivery, and a closed project shows where it stopped", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "overview");
  const doc = (id: string, type: string, more: Record<string, string> = {}) => ({
    id,
    type,
    label: type,
    url: `https://links.example.com/${id}`,
    uploadedBy: "julian",
    ...more,
  });
  const item = (label: string) => page.getByRole("listitem").filter({ hasText: label });
  await patchProject(p.id, {
    status: "booked",
    payment_method: "zelle",
    documents: [doc("c1", "contract"), doc("i1", "invoice", { dueAt: "2027-01-01", paidAt: "2026-11-20" })],
  });

  await page.goto(p.page);
  await expect(page.getByRole("heading", { name: "Toward the shoot" })).toBeVisible();
  await expect(item("Contract added")).toContainText(": done");
  await expect(item("Retainer paid")).toContainText(": done");
  await expect(item("How they'll pay")).toContainText("Zelle");
  await expect(item("Questionnaire back")).toContainText(": not yet");
  await expect(item("Timeline details sent")).toContainText(": not yet");

  await patchProject(p.id, {
    status: "delivered",
    documents: [
      doc("c1", "contract"),
      doc("i1", "invoice", { dueAt: "2027-01-01", paidAt: "2026-11-20" }),
      doc("g1", "gallery"),
    ],
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Toward delivery" })).toBeVisible();
  await expect(item("Gallery added")).toContainText(": done");
  await expect(item("Gallery email sent")).toContainText(": not yet");
  await expect(item("Invoices paid")).toContainText(": done");

  // Closed after booking: the tracker and the Overview stop at Reserving your date.
  const history = (await readProject(p.id, "status_history")).status_history as unknown[];
  await patchProject(p.id, {
    status: "archived",
    status_history: [...history, { status: "booked" }, { status: "archived" }],
  });
  await page.reload();
  await expect(page.getByText("Closed at Reserving your date", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Toward the shoot" })).toBeVisible();
});

test("Already sent moves the project on as the email would, and Mark handled settles a message", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "already");
  await patchProject(p.id, {
    status: "in-conversation",
    event_date: shiftDay(studioToday(), { days: 120 }),
    documents: [{ id: "pr", type: "proposal", label: "Proposal", url: "https://links.example.com/pr", uploadedBy: "julian" }],
  });
  await page.goto(p.page);
  await expect(nextStep(page)).toContainText("Send the proposal");
  await nextStep(page).getByRole("button", { name: "Already sent" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Noted as sent." })).toBeVisible();
  // The proposal moved the project to Proposal sent, as sending it would have.
  await expect(page.getByText(/^Step \d+ of \d+: Proposal$/)).toBeVisible();
  await expect(nextStep(page)).toContainText("Waiting on E2E's answer");
  const moved = (await readProject(p.id, "status, status_history")) as {
    status: string;
    status_history: { status?: string; note?: string }[];
  };
  expect(moved.status).toBe("proposal-sent");
  expect(moved.status_history.at(-1)).toMatchObject({ status: "proposal-sent", note: "Proposal noted as sent" });

  // A stage email that moves nothing (the status set by hand past it) is noted on its own.
  await patchProject(p.id, { status: "contract-signed" });
  await page.reload();
  await expect(nextStep(page)).toContainText("Send the booking welcome");
  await nextStep(page).getByRole("button", { name: "Already sent" }).click();
  await expect(nextStep(page)).toContainText("Planning starts about two months before the shoot");
  const noted = (await readProject(p.id, "status_history")).status_history as { kind?: string; note?: string }[];
  expect(noted.at(-1)).toMatchObject({ kind: "note", note: "Booking welcome noted as sent" });

  // A client's message answered another way is marked handled, here and on Today.
  const wrote = new Date().toISOString();
  await addMessage(p.id, { direction: "in", sentAt: wrote });
  await page.reload();
  await expect(nextStep(page)).toContainText("Answer E2E");
  await nextStep(page).getByRole("button", { name: "Mark handled" }).click();
  await expect(nextStep(page)).toContainText("Planning starts about two months before the shoot");
  const dismissed = (await readProject(p.id, "today_dismissed")).today_dismissed as Record<string, string>;
  expect(Object.entries(dismissed).some(([k, v]) => k.startsWith("reply:") && v === "handled")).toBe(true);
});

test("a proposal follow-up after the hold ran out settles Today's row about it", async ({ adminRequest }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "holdrow");
  const ended = shiftDay(studioToday(), { days: -2 });
  await patchProject(p.id, { status: "proposal-sent", hold_until: ended });
  const res = await adminRequest.post("/api/admin/send-email", {
    data: { projectId: p.id, templateId: "proposal-follow-up", subject: "Following up", body: "Hi,\n\nChecking in.\n\nJulian" },
  });
  expect(res.status()).toBe(200);
  expect((await readProject(p.id, "today_dismissed")).today_dismissed).toMatchObject({ [`hold:${ended}`]: "handled" });
});

test("compose: a template picked brings back its unsent email, and sending another leaves it kept", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "keep");
  const tabs = page.getByRole("navigation", { name: "Project" });
  const body = page.getByLabel("Email body");
  const template = page.getByRole("combobox", { name: "Email template" });

  await page.goto(`${p.page}?tab=messages`);
  await template.selectOption("proposal");
  await body.fill("Hi,\n\nThe proposal, in my words.\n\nJulian");

  // Looking at another template shows its fill; picking Proposal again
  // brings the email back.
  await template.selectOption("planning-kickoff");
  await expect(body).not.toHaveValue(/The proposal, in my words/);
  await template.selectOption("proposal");
  await expect(body).toHaveValue(/The proposal, in my words/);

  // A hand-off to the same template, from where it was started, shows it too.
  await patchProject(p.id, {
    status: "in-conversation",
    documents: [{ id: "pr", type: "proposal", label: "Proposal", url: "https://links.example.com/pr", uploadedBy: "julian" }],
  });
  await tabs.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByText("No inquiry message on this project.")).toBeVisible();
  await expect(nextStep(page)).toContainText("Send the proposal");
  await nextStep(page).getByRole("link", { name: "Write the email" }).click();
  await expect(body).toHaveValue(/The proposal, in my words/);

  // Open on a hand-off, Write email goes to the tab, which shows the email kept.
  await page.getByRole("link", { name: "Write email", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=messages#compose$/);
  await expect(body).toHaveValue(/The proposal, in my words/);

  // Another email, sent as it was filled, leaves the proposal kept.
  await template.selectOption("discovery-invite");
  await page.getByRole("button", { name: "Send to client" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent to the client." })).toBeVisible();
  await tabs.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByText("No inquiry message on this project.")).toBeVisible();
  await tabs.getByRole("link", { name: "Messages" }).click();
  await expect(template).toHaveValue("proposal");
  await expect(body).toHaveValue(/The proposal, in my words/);
});

test("an email the client marked as spam still counts as sent", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "spam");
  await patchProject(p.id, { status: "scheduled", event_date: shiftDay(studioToday(), { days: 3 }) });
  const res = await adminRequest.post("/api/admin/send-email", {
    data: { projectId: p.id, templateId: "week-of", subject: "This week", body: "Hi,\n\nSee you soon.\n\nJulian" },
  });
  const { id: resendId } = await res.json();
  expect(resendId).toBeTruthy();
  const complained = {
    type: "email.complained",
    created_at: new Date().toISOString(),
    data: { email_id: resendId, created_at: new Date().toISOString(), from: "", to: [], subject: "" },
  };
  expect((await adminRequest.post("/api/email/webhook", signedWebhook(complained))).status()).toBe(200);
  const { data } = await testStore()!.from("client_messages").select("status").eq("project_id", p.id);
  expect(data).toEqual([{ status: "complained" }]);

  await page.goto(p.page);
  await expect(nextStep(page)).toContainText("Shoot in 3 days");
});
