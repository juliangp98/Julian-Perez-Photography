import type { APIRequestContext, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, hasTestStore } from "./support/fixtures";
import { patchProject, readProject, testStore } from "./support/test-store";
import { stagesFor } from "../../src/lib/client-status";
import {
  ownerNextStep,
  sentTemplates,
  type NextStepContext,
  type NextStepProject,
} from "../../src/lib/next-step";
import { formatHumanDate, shiftDay, studioToday } from "../../src/lib/field-format";

// The admin project page (/admin/projects/[id]): a header with the facts, the
// stage tracker, the one next step, the status and the follow-up, over five
// tabs (Overview, Call, Messages, Links & files, Details). The stage and
// next-step rules (src/lib/client-status.ts, src/lib/next-step.ts) are checked
// directly; the page against the test store.

const TODAY = "2026-11-25";
const ctx = (over: Partial<NextStepContext> = {}): NextStepContext => ({
  today: TODAY,
  sent: new Set(),
  questionnaire: true,
  ...over,
});
const next = (p: Partial<NextStepProject>, c = ctx()) =>
  ownerNextStep({ id: "p", email: "client@example.com", clientName: "Avery Example", ...p }, c);
const compose = (template: string) => `/admin/projects/p?compose=${template}#compose`;
const tab = (name: string) => `/admin/projects/p?tab=${name}`;
const sent = (...ids: string[]) => ctx({ sent: new Set(ids) });
const own = (type: string, more: Record<string, string> = {}) => ({ type, uploadedBy: "julian", ...more });

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
  expect(next({ status: "proposal-sent" })).toMatchObject({
    title: "Waiting on Avery's answer",
    action: { href: tab("links") },
  });
  expect(next({ status: "proposal-sent", followUpAt: TODAY }).action?.href).toBe(compose("proposal-follow-up"));
  expect(next({ status: "proposal-sent", holdUntil: "2026-11-20" })).toMatchObject({
    title: "The date hold ended",
    detail: "It ran until November 20, 2026. Follow up, or let the date go.",
  });
  expect(
    next({ status: "proposal-sent", documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })] }).action
      ?.href,
  ).toBe(compose("contract-deposit"));
  // A yes after the hold ran out still gets the contract; a follow-up set past
  // the hold (the follow-up email sets one) means it was followed up.
  expect(
    next({
      status: "proposal-sent",
      holdUntil: "2026-11-20",
      documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })],
    }).action?.href,
  ).toBe(compose("contract-deposit"));
  expect(next({ status: "proposal-sent", holdUntil: "2026-11-20", followUpAt: "2026-11-27" }).title).toBe(
    "Waiting on Avery's answer",
  );

  // Reserving the date: the paperwork, the retainer, then the welcome.
  expect(next({ status: "booked" }).title).toBe("Add the Square contract and invoice");
  expect(next({ status: "booked", documents: [own("contract"), own("invoice", { dueAt: "2026-12-01" })] })).toMatchObject({
    title: "Waiting on the signed contract and retainer",
    detail: "It's due December 1, 2026. Mark the invoice paid when it comes in.",
  });
  expect(next({ status: "booked", documents: [own("contract"), own("invoice", { dueAt: "2026-11-20" })] })).toMatchObject({
    title: "The retainer is overdue",
    action: { href: compose("payment-reminder") },
  });
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

  // Planning starts within two months of the shoot.
  expect(next({ status: "contract-signed" }).action?.href).toBe(compose("planning-kickoff"));
  expect(next({ status: "contract-signed", eventDate: "2027-01-10" }).action?.href).toBe(compose("planning-kickoff"));
  expect(next({ status: "contract-signed", eventDate: "2027-06-12" })).toEqual({
    title: "Booked",
    detail: "Planning starts about two months before the shoot, around April 13, 2027. Nothing to send yet.",
  });

  // Planning: the questionnaire, then the timeline.
  expect(next({ status: "planning" })).toMatchObject({
    title: "Waiting on the questionnaire",
    action: { href: compose("questionnaire-reminder") },
  });
  expect(next({ status: "planning", questionnaireSnapshot: "{}" }).action?.href).toBe(compose("timeline-details"));
  expect(next({ status: "planning" }, ctx({ questionnaire: false })).action?.href).toBe(compose("timeline-details"));

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
  // A new inquiry's answer is the inquiry reply.
  expect(next({ status: "new-inquiry", ...wrote }).action).toEqual({
    label: "Draft a reply",
    href: compose("inquiry-reply"),
  });
  // A message marked handled, or snoozed past today, on the Today list needs no answer here.
  const key = `reply:${wrote.lastInAt}`;
  expect(next({ status: "proposal-sent", ...wrote, todayDismissed: { [key]: "handled" } }).title).toBe(
    "Waiting on Avery's answer",
  );
  expect(next({ status: "proposal-sent", ...wrote, todayDismissed: { [key]: "2026-11-28" } }).title).toBe(
    "Waiting on Avery's answer",
  );
  expect(next({ status: "proposal-sent", ...wrote, todayDismissed: { [key]: "2026-11-24" } }).title).toBe("Answer Avery");
  expect(next({ status: "lost", ...wrote }).title).toBe("Closed as lost");
  expect(next({ status: "booked", email: "", ...wrote }).title).toBe("Add the client's email");
  expect(next({ status: "proposal-sent", lastInAt: "2026-11-20T15:00:00Z", lastOutAt: "2026-11-23T15:00:00Z" }).title).toBe(
    "Waiting on Avery's answer",
  );
  expect(next({ status: "booked", email: "" })).toMatchObject({
    title: "Add the client's email",
    action: { href: tab("details") },
  });
  expect(next({ status: "lost" }).action?.href).toBe(compose("re-engagement"));
  expect(next({ status: "archived" })).toEqual({
    title: "Closed",
    detail: "Nothing left to do. Change the status to reopen it.",
  });
  // A contract the client uploaded isn't the Square one.
  expect(next({ status: "booked", documents: [{ type: "contract", uploadedBy: "client" }, own("invoice")] }).title).toBe(
    "Add the Square contract and invoice",
  );
});

test("sent templates: recorded ones, and older emails by subject or by the activity log", () => {
  const sentIds = sentTemplates(
    [
      { direction: "out", template: "week-of", subject: "Anything" },
      // Sent before templates were recorded, with the subject as the template had it.
      { direction: "out", subject: "Your Smith Wedding gallery is ready" },
      { direction: "out", subject: "Re: Your wedding inquiry" },
      { direction: "in", subject: "Would you leave a review?" },
    ],
    [{ note: "Booking welcome sent" }, { note: "Updated by admin" }],
  );
  expect([...sentIds].sort()).toEqual(["booking-welcome", "gallery-delivery", "week-of"]);
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

test("status: picking one saves it and moves the tracker; closing asks first and clears the follow-up", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "status");
  await page.goto(p.page);

  await page.locator("#project-status").selectOption("in-conversation");
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByText("Step 2 of 10: Call", { exact: true })).toBeVisible();
  await expect(nextStep(page)).toContainText("Add the proposal link");
  expect((await readProject(p.id, "status")).status).toBe("in-conversation");

  // Closing asks; saying no leaves it as it was.
  await patchProject(p.id, { follow_up_at: shiftDay(studioToday(), { days: 5 }), follow_up_note: "Check in" });
  await page.reload();
  page.once("dialog", (d) => d.dismiss());
  await page.locator("#project-status").selectOption("lost");
  await expect(page.locator("#project-status")).toHaveValue("in-conversation");
  expect((await readProject(p.id, "status")).status).toBe("in-conversation");

  page.once("dialog", (d) => d.accept());
  await page.locator("#project-status").selectOption("lost");
  await expect(page.getByText("Closed at Call", { exact: true })).toBeVisible();
  await expect(page.getByText("None set.")).toBeVisible();
  await expect(nextStep(page)).toContainText("Closed as lost");
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
