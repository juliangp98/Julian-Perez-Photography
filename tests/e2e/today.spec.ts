import type { APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, hasTestStore } from "./support/fixtures";
import { addMessage, newProject as createProject, patchProject, readProject } from "./support/test-store";
import { morningEmail, todayRows, type TodayProject, type TodayServiceTerms } from "../../src/lib/today";
import {
  eventDay,
  eventMonthYear,
  formatEventDate,
  formatHumanDate,
  shiftDay,
  studioToday,
} from "../../src/lib/field-format";
import { autoProjectName } from "../../src/lib/project-name";
import { SITE_URL } from "../../src/lib/site-settings-data";

// The Today list on the projects board (src/lib/today.ts): what needs the
// owner now, worked out from the projects with rules, and the morning email
// built from the same rows. The rules are checked directly; the board against
// the test store, where each row can be marked handled or snoozed.

const TODAY = "2026-11-25";
const terms = (questionnaire = true, turnaroundDays?: number) => (): TodayServiceTerms => ({
  questionnaire,
  turnaroundDays,
});
const one = (p: Partial<TodayProject>, t = terms()) =>
  todayRows([{ id: "p", name: "Test project", ...p }], TODAY, t);

test("a follow-up that's due shows, and one later doesn't", () => {
  expect(one({ followUpAt: "2026-11-25", followUpNote: "Follow up on the proposal" })).toMatchObject([
    { rule: "follow-up", reason: "Follow up on the proposal (due today)" },
  ]);
  expect(one({ followUpAt: "2026-11-20" })[0].reason).toBe("Follow up (due November 20, 2026)");
  expect(one({ followUpAt: "2026-11-26" })).toEqual([]);
});

test("a client who wrote last shows until answered", () => {
  const rows = one({ status: "proposal-sent", clientName: "Avery Example", lastInAt: "2026-11-23T15:00:00Z", lastOutAt: "2026-11-20T15:00:00Z" });
  expect(rows).toMatchObject([{ rule: "reply", reason: "Avery wrote 2 days ago, not answered yet" }]);
  expect(one({ status: "proposal-sent", lastInAt: "2026-11-20T15:00:00Z", lastOutAt: "2026-11-23T15:00:00Z" })).toEqual([]);
  // A new inquiry's answer is the inquiry reply; later, Compose opens on no template.
  expect(rows[0].action.href).toBe("/admin/projects/p?tab=messages#compose");
  expect(one({ status: "new-inquiry", lastInAt: "2026-11-23T15:00:00Z" })[0].action.href).toBe(
    "/admin/projects/p?compose=inquiry-reply#compose",
  );
  // Answered outside the site (the inquiry, or an earlier message, marked
  // handled), or booked by phone (a contract on it): a plain reply.
  expect(
    one({
      status: "new-inquiry",
      lastInAt: "2026-11-23T15:00:00Z",
      todayDismissed: { "reply:2026-11-20T15:00:00Z": "handled" },
    })[0].action.href,
  ).toBe("/admin/projects/p?tab=messages#compose");
  expect(
    one({ status: "new-inquiry", lastInAt: "2026-11-23T15:00:00Z", documents: [{ type: "contract", uploadedBy: "julian" }] })[0]
      .action.href,
  ).toBe("/admin/projects/p?tab=messages#compose");
  expect(
    one({ status: "new-inquiry", lastInAt: "2026-11-23T15:00:00Z", todayDismissed: { inquiry: "handled" } })[0].action.href,
  ).toBe("/admin/projects/p?tab=messages#compose");
  // An evening message counts on the studio's day it was sent.
  expect(one({ status: "proposal-sent", lastInAt: "2026-11-25T02:30:00Z" })).toMatchObject([
    { rule: "reply", reason: "The client wrote yesterday, not answered yet", due: "2026-11-24" },
  ]);
});

test("a new inquiry nobody answered shows at any age, due from the day it came", () => {
  expect(one({ status: "new-inquiry" })).toMatchObject([{ rule: "inquiry", action: { label: "Draft a reply" } }]);
  expect(one({ status: "new-inquiry", lastOutAt: "2026-11-24T10:00:00Z" })).toEqual([]);
  // Booked by phone (a contract on it): nothing to reply to.
  expect(one({ status: "new-inquiry", documents: [{ type: "contract", uploadedBy: "julian" }] })).toEqual([]);
  expect(one({ status: "new-inquiry", createdAt: "2026-11-01T12:00:00Z" })).toMatchObject([
    { rule: "inquiry", reason: "New inquiry 3 weeks ago, not answered yet", due: "2026-11-01" },
  ]);
  // The oldest wait comes first: the inquiry before a follow-up due yesterday.
  const rows = todayRows(
    [
      { id: "a", name: "A follow-up", followUpAt: "2026-11-24" },
      { id: "b", name: "B inquiry", status: "new-inquiry", createdAt: "2026-11-01T12:00:00Z" },
    ],
    TODAY,
    terms(),
  );
  expect(rows.map((r) => r.rule)).toEqual(["inquiry", "follow-up"]);
});

test("an expired hold shows for a lead, not once they've booked", () => {
  expect(one({ status: "proposal-sent", holdUntil: "2026-11-20" })).toMatchObject([
    { rule: "hold", reason: "Date hold ended November 20, 2026, not booked" },
  ]);
  expect(one({ status: "booked", holdUntil: "2026-11-20" })).toEqual([]);
  expect(one({ status: "proposal-sent", holdUntil: "2026-11-25" })).toEqual([]);
  // A yes (the contract added) before the status moved.
  expect(
    one({ status: "proposal-sent", holdUntil: "2026-11-20", documents: [{ type: "contract", uploadedBy: "julian" }] }),
  ).toEqual([]);
});

test("an unpaid invoice due within a week shows; a paid or later one doesn't", () => {
  const invoice = (dueAt: string, paidAt?: string) => ({ id: "i1", type: "invoice", label: "Retainer", dueAt, paidAt });
  expect(one({ status: "booked", documents: [invoice("2026-12-01")] })[0].reason).toBe("Retainer due December 1, 2026");
  expect(one({ status: "booked", documents: [invoice("2026-11-20")] })[0].reason).toBe("Retainer overdue since November 20, 2026");
  expect(one({ status: "booked", documents: [invoice("2026-12-03")] })).toEqual([]);
  expect(one({ status: "booked", documents: [invoice("2026-11-20", "2026-11-19")] })).toEqual([]);
  // Handled while it was coming due, it still shows once it's overdue.
  const late = { status: "booked", documents: [invoice("2026-11-20")] };
  expect(one({ ...late, todayDismissed: { "invoice:i1:2026-11-20:due": "handled" } })).toHaveLength(1);
  expect(one({ ...late, todayDismissed: { "invoice:i1:2026-11-20:overdue": "handled" } })).toEqual([]);
});

test("a booked shoot two weeks out with no questionnaire shows", () => {
  expect(one({ status: "booked", eventDate: "2026-12-05" })[0].reason).toBe("Shoot in 10 days, no questionnaire yet");
  expect(one({ status: "booked", eventDate: "2026-12-05", questionnaireSnapshot: "{}" })).toEqual([]);
  expect(one({ status: "booked", eventDate: "2026-12-15" })).toEqual([]);
  expect(one({ status: "proposal-sent", eventDate: "2026-12-05" })).toEqual([]);
  // A service with no questionnaire has nothing to chase.
  expect(one({ status: "booked", eventDate: "2026-12-05" }, terms(false))).toEqual([]);
  expect(one({ status: "booked", eventDate: "2026-11-26" })[0].reason).toBe("Shoot tomorrow, no questionnaire yet");
  // An older free-text date still counts; one without a year can't be placed.
  expect(one({ status: "booked", eventDate: "12/05/2026" })[0]).toMatchObject({
    reason: "Shoot in 10 days, no questionnaire yet",
    key: "questionnaire:2026-12-05",
  });
  expect(one({ status: "booked", eventDate: "Dec 5" })).toEqual([]);
});

test("an event date counts only when it names one day", () => {
  for (const [text, day] of [
    ["2026-12-05", "2026-12-05"],
    ["12/05/2026", "2026-12-05"],
    ["Aug 15, 2027", "2027-08-15"],
    ["15 Aug 2027", "2027-08-15"],
    ["Sunday, August 15th, 2027", "2027-08-15"],
    ["June 6,2026", "2026-06-06"],
    ["June 6, 2026.", "2026-06-06"],
    ["June 6, 2026. ", "2026-06-06"],
    ["Sat., June 6, 2026", "2026-06-06"],
    ["Jun 6 , 2026", "2026-06-06"],
  ]) {
    expect(eventDay(text), text).toBe(day);
  }
  for (const text of [
    "Nov 20-21, 2026",
    "Nov 20-21,2026",
    "Oct 10-11, 2026",
    "Fall 2027",
    "TBD 2027",
    "May or June 2027",
    "June 2027",
    "2027",
    "2027-06",
    "6/5/27",
    "Feb 30, 2027",
    "0026-06-06",
    "06/06/0026",
    // A hedge, or a weekday that isn't the date's.
    "TBD June 6, 2027",
    "Before June 6, 2026",
    "Saturday, August 15th, 2027",
  ]) {
    expect(eventDay(text), text).toBe("");
  }
  // Shown as typed when it isn't one day; read for search by month and year.
  expect(formatEventDate("Fall 2027")).toBe("Fall 2027");
  expect(formatEventDate("June 6th, 2026")).toBe("June 6, 2026");
  expect(formatEventDate("2026-06-06", { month: "short" })).toBe("Jun 6, 2026");
  expect(eventMonthYear("June 2027")).toEqual({ month: 6, year: 2027 });
  expect(eventMonthYear("Fall 2027")).toEqual({ month: null, year: 2027 });
  expect(eventMonthYear("Nov 20-21, 2026")).toEqual({ month: null, year: 2026 });
  expect(eventMonthYear("TBD")).toBeNull();
  expect(eventMonthYear("June,2027")).toEqual({ month: 6, year: 2027 });
  expect(eventMonthYear("Sept. 2027.")).toEqual({ month: 9, year: 2027 });
  // A project's automatic name carries the day only when there is one.
  const named = (eventDate: string) => autoProjectName({ clientName: "Jane Doe", serviceType: "weddings", eventDate });
  for (const text of ["Fall 2027", "Nov 20-21, 2026", "TBD June 6, 2027"]) {
    expect(named(text), text).not.toContain(" on ");
  }
  expect(named("Saturday, June 6th, 2026")).toMatch(/ on 6\/6\/2026$/);
  // A range isn't a shoot day: no editing row from a guessed date.
  expect(one({ status: "editing", eventDate: "Nov 20-21, 2026" }, terms(true, 30))).toEqual([]);
});

test("editing past the service's turnaround shows", () => {
  expect(one({ status: "editing", eventDate: "2026-10-01" }, terms(true, 28))[0].reason).toBe(
    "Gallery was due October 29, 2026 (28-day turnaround)",
  );
  expect(one({ status: "editing", eventDate: "2026-11-01" }, terms(true, 28))).toEqual([]);
  // Without a turnaround set, there's nothing to measure.
  expect(one({ status: "editing", eventDate: "2026-10-01" })).toEqual([]);
});

test("a row marked handled stays gone; a snoozed one comes back on its day", () => {
  const p = { status: "proposal-sent", holdUntil: "2026-11-20" };
  expect(one({ ...p, todayDismissed: { "hold:2026-11-20": "handled" } })).toEqual([]);
  expect(one({ ...p, todayDismissed: { "hold:2026-11-20": "2026-11-28" } })).toEqual([]);
  expect(one({ ...p, todayDismissed: { "hold:2026-11-20": "2026-11-25" } })).toHaveLength(1);
  // A new hold is a new row.
  expect(one({ status: "proposal-sent", holdUntil: "2026-11-22", todayDismissed: { "hold:2026-11-20": "handled" } })).toHaveLength(1);
});

test("a closed project keeps only its follow-up, and a lost lead writing back after the close", () => {
  const closed = { followUpAt: "2026-11-25", holdUntil: "2026-11-20", lastInAt: "2026-11-24T00:00:00Z" };
  expect(one({ status: "archived", ...closed })).toMatchObject([{ rule: "follow-up" }]);
  // A message from before it was closed as lost had its answer in the closing.
  expect(
    one({ status: "lost", ...closed, statusHistory: [{ status: "lost", changedAt: "2026-11-24T12:00:00Z" }] }),
  ).toMatchObject([{ rule: "follow-up" }]);
  // One after it is the check-in working: Reply opens Compose.
  const back = one({ status: "lost", ...closed, statusHistory: [{ status: "lost", changedAt: "2026-11-20T12:00:00Z" }] });
  expect(back.map((r) => r.rule)).toEqual(["reply", "follow-up"]);
  expect(back[0].action.href).toBe("/admin/projects/p?tab=messages#compose");
});

// The morning email lists the day's rows, in the board's order, on the
// site's own address, with no names in the subject or preview.
test("the morning email lists the day's rows in order, with links on the site's address", () => {
  const rows = todayRows(
    [
      { id: "a", name: "Avery's Wedding", followUpAt: "2026-11-24", followUpNote: "Check the agreement came in" },
      { id: "b", name: "Blair's Portraits", status: "new-inquiry", createdAt: "2026-11-01T15:00:00Z" },
    ],
    TODAY,
    terms(),
  );
  expect(morningEmail(rows, TODAY)).toEqual({
    subject: "Today, November 25: 2 things need you",
    preview: "Wednesday's list, longest waiting first.",
    heading: "Wednesday, November 25",
    lines: ["Longest waiting first. Mark each one handled, or snooze it, on the board."],
    items: [
      {
        title: "Blair's Portraits",
        text: "New inquiry 3 weeks ago, not answered yet",
        link: { label: "Draft a reply", href: `${SITE_URL}/admin/projects/b?compose=inquiry-reply#compose` },
      },
      {
        title: "Avery's Wedding",
        text: "Check the agreement came in (due November 24, 2026)",
        link: { label: "Open", href: `${SITE_URL}/admin/projects/a` },
      },
    ],
    cta: { label: "Open the board →", href: `${SITE_URL}/admin/projects` },
  });
});

test("one row reads in the singular, and a day with none sends nothing", () => {
  expect(morningEmail(one({ followUpAt: TODAY }), TODAY)?.subject).toBe("Today, November 25: 1 thing needs you");
  expect(morningEmail([], TODAY)).toBeNull();
  // A row marked handled, or snoozed past today, leaves nothing to send.
  const hold = { status: "proposal-sent", holdUntil: "2026-11-20" };
  expect(morningEmail(one({ ...hold, todayDismissed: { "hold:2026-11-20": "handled" } }), TODAY)).toBeNull();
  expect(morningEmail(one({ ...hold, todayDismissed: { "hold:2026-11-20": "2026-11-28" } }), TODAY)).toBeNull();
  // The month and day alone, for the subject and heading.
  expect(formatHumanDate("2026-11-25", { withYear: false })).toBe("November 25");
  expect(formatHumanDate("2026-11-25")).toBe("November 25, 2026");
});

const newProject = async (request: APIRequestContext, tag: string) => (await createProject(request, `Today ${tag}`)).id;

test("the board shows each rule's row, and a reply can be marked handled", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const today = studioToday();
  const stamp = Date.now();
  const replied = await newProject(adminRequest, `reply-${stamp}`);
  await patchProject(replied, { status: "proposal-sent" });
  // Midday three studio days ago, whatever the clock change in between.
  await addMessage(replied, { direction: "out", sentAt: `${shiftDay(today, { days: -3 })}T17:00:00Z` });
  await addMessage(replied, { direction: "in" });
  const held = await newProject(adminRequest, `hold-${stamp}`);
  await patchProject(held, { status: "proposal-sent", hold_until: shiftDay(today, { days: -2 }) });
  const due = await newProject(adminRequest, `follow-${stamp}`);
  await patchProject(due, { follow_up_at: today, follow_up_note: "Check the agreement came in" });
  const done = await newProject(adminRequest, `done-${stamp}`);
  await patchProject(done, { follow_up_at: today, follow_up_note: "Send the timeline" });
  const stale = await newProject(adminRequest, `stale-${stamp}`);
  await patchProject(stale, { follow_up_at: today, follow_up_note: "Check the stale follow-up" });

  await page.goto(`/admin/projects`);
  const list = page.getByRole("region", { name: "Today" });
  const row = (tag: string) => list.getByRole("listitem").filter({ hasText: `E2E Today ${tag}` });
  await expect(row(`reply-${stamp}`)).toContainText("wrote today, not answered yet");
  await expect(row(`hold-${stamp}`)).toContainText("Date hold ended");
  // A new project also shows as an unanswered inquiry; the follow-up is its own row.
  const followUp = row(`follow-${stamp}`).filter({ hasText: "Check the agreement came in" });
  await expect(followUp).toContainText("Check the agreement came in (due today)");

  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast", "region"]).analyze();
  expect(scan.violations).toEqual([]);

  await row(`reply-${stamp}`).getByRole("button", { name: "Mark handled" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Marked handled." })).toBeVisible();
  await expect(row(`reply-${stamp}`)).toHaveCount(0);

  // Snoozing a follow-up moves it, so it's gone until then.
  await followUp.getByRole("button", { name: "Snooze" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Snoozed for 3 days." })).toBeVisible();
  await expect(followUp).toHaveCount(0);
  expect(await readProject(due, "follow_up_at, follow_up_note")).toEqual({
    follow_up_at: shiftDay(today, { days: 3 }),
    follow_up_note: "Check the agreement came in",
  });

  // Mark handled on a follow-up clears it, note and all.
  const doneRow = row(`done-${stamp}`).filter({ hasText: "Send the timeline" });
  await doneRow.getByRole("button", { name: "Mark handled" }).click();
  await expect(doneRow).toHaveCount(0);
  expect(await readProject(done, "follow_up_at, follow_up_note")).toEqual({ follow_up_at: null, follow_up_note: null });

  // Snooze on any other row is saved on the project until its day.
  await row(`hold-${stamp}`).getByRole("button", { name: "Snooze" }).click();
  await expect(row(`hold-${stamp}`)).toHaveCount(0);
  expect((await readProject(held, "today_dismissed")).today_dismissed).toEqual({
    [`hold:${shiftDay(today, { days: -2 })}`]: shiftDay(today, { days: 3 }),
  });

  // A follow-up changed since the page loaded is left alone, and the list reloads.
  const staleRow = row(`stale-${stamp}`).filter({ hasText: "Check the stale follow-up" });
  await expect(staleRow).toBeVisible();
  const later = shiftDay(today, { days: 7 });
  await patchProject(stale, { follow_up_at: later, follow_up_note: "Last check-in" });
  await staleRow.getByRole("button", { name: "Mark handled" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That follow-up changed since the page loaded" })).toBeVisible();
  await expect(staleRow).toHaveCount(0);
  expect(await readProject(stale, "follow_up_at, follow_up_note")).toEqual({ follow_up_at: later, follow_up_note: "Last check-in" });

  // The card says when each side last wrote, in the same days.
  const leads = page.getByRole("heading", { name: /^Leads/ }).locator("..");
  await expect(leads.locator("a", { hasText: `E2E Today reply-${stamp}` })).toContainText(
    "Client wrote today, you 3 days ago",
  );

  await page.goto(`/admin/projects/${due}`);
  await expect(page.getByText(/: Check the agreement came in$/)).toBeVisible();

  // A newer message from the client brings the reply row back.
  await addMessage(replied, { direction: "in", sentAt: new Date(Date.now() + 1000).toISOString() });
  await page.goto(`/admin/projects`);
  await expect(row(`reply-${stamp}`)).toBeVisible();
});

test("the board groups projects by phase, with Closed folded", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const stamp = Date.now();
  const lost = await newProject(adminRequest, `lost-${stamp}`);
  await patchProject(lost, { status: "lost" });
  await page.goto(`/admin/projects?q=${encodeURIComponent(`E2E Today lost-${stamp}`)}`);
  const closed = page.locator("details").filter({ hasText: "Closed" });
  await expect(closed).toBeVisible();
  await expect(closed.getByText(`E2E Today lost-${stamp}`)).toBeHidden();
  await closed.locator("summary").click();
  await expect(closed.getByText(`E2E Today lost-${stamp}`)).toBeVisible();
});

test("one search box narrows the board to projects with every word", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const stamp = Date.now();
  await newProject(adminRequest, `search-${stamp}`);
  await page.goto("/admin/projects");
  // Words in any order, one of them the service. (Typed again until the page
  // is live, so the words reach the box's state.)
  await expect(async () => {
    await page.getByLabel("Search projects").fill(`weddings search-${stamp}`);
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=weddings\\+search-${stamp}`));
  await expect(page.getByText(/^1 of \d+ projects?$/)).toBeVisible();
  const leads = page.getByRole("heading", { name: /^Leads/ }).locator("..");
  await expect(leads.getByText(`E2E Today search-${stamp}`)).toBeVisible();
  await expect(leads.locator('a[href^="/admin/projects/"]')).toHaveCount(1);

  // Back to the whole board: the box follows the address.
  await page.goBack();
  await expect(page.getByLabel("Search projects")).toHaveValue("");
});

test("an Ask answered after the search changed is dropped", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const stamp = Date.now();
  await newProject(adminRequest, `ask-${stamp}`);
  let release!: () => void;
  let held = new Promise<void>((r) => (release = r));
  await page.route("**/api/admin/search", async (route) => {
    await held;
    await route.fulfill({ json: { ok: true, searched: true, summary: "Late answer", matches: [] } });
  });
  await page.goto("/admin/projects");
  const box = page.getByLabel("Search projects");
  const ask = page.getByRole("button", { name: "Ask", exact: true });
  const answer = page.getByRole("status").filter({ hasText: "Late answer" });

  // With nothing changing, an Ask shows its answer. (Typed again until the
  // page is live, so the words reach the box's state.)
  await expect(async () => {
    await box.fill(`ask-${stamp}`);
    await expect(ask).toBeEnabled({ timeout: 1000 });
  }).toPass();
  await ask.click();
  release();
  await expect(answer).toBeVisible();

  // A Search changes the address; an Ask sent from there, answered after
  // going Back, is dropped.
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=ask-${stamp}`));
  await expect(answer).toHaveCount(0);
  held = new Promise<void>((r) => (release = r));
  await ask.click();
  await page.goBack();
  await expect(page).not.toHaveURL(/q=/);
  await expect(box).toHaveValue("");
  release();
  await page.waitForTimeout(500);
  await expect(answer).toHaveCount(0);
});

test("Today's actions need the owner's session", async ({ request }) => {
  expect((await request.post("/api/admin/update", { data: { id: "p1", dismiss: { key: "x" } } })).status()).toBe(401);
  expect((await request.post("/api/admin/update", { data: { id: "p1", followUp: { at: null } } })).status()).toBe(401);
});

test("Today's actions: a follow-up changed since the page loaded is left alone, and bad input is refused", async ({
  adminRequest,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  for (const bad of [
    { dismiss: { key: "" } },
    { dismiss: { key: "x".repeat(201) } },
    { dismiss: { key: "hold:2026-11-20", until: "next week" } },
    { followUp: { at: "tomorrow" } },
    { followUp: { at: null, expect: "soon" } },
  ]) {
    expect((await adminRequest.post("/api/admin/update", { data: { id: "p1", ...bad } })).status(), JSON.stringify(bad)).toBe(400);
  }

  const id = await newProject(adminRequest, `expect-${Date.now()}`);
  await patchProject(id, { follow_up_at: "2030-01-10", follow_up_note: "Check in" });
  const clear = (expect: string) => adminRequest.post("/api/admin/update", { data: { id, followUp: { at: null, expect } } });
  expect((await clear("2030-01-03")).status()).toBe(409);
  expect(await readProject(id, "follow_up_at")).toEqual({ follow_up_at: "2030-01-10" });
  expect((await clear("2030-01-10")).status()).toBe(200);
  expect(await readProject(id, "follow_up_at")).toEqual({ follow_up_at: null });
});

// Only the client's own writing counts as them writing: mail Julian files from
// a venue, or a second photographer's reply, leaves Today and the project
// page as they were.
test("a vendor's or a second photographer's mail isn't the client writing", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const today = studioToday();
  const stamp = Date.now();
  const id = await newProject(adminRequest, `vendor-${stamp}`);
  await patchProject(id, { status: "proposal-sent" });
  await addMessage(id, { direction: "out", sentAt: `${shiftDay(today, { days: -3 })}T17:00:00Z` });
  await addMessage(id, { direction: "in", fromAddr: "Riverside Venue <events@venue.test>", kind: "imported" });
  await addMessage(id, { direction: "in", fromAddr: "Second <second@shooters.test>" });

  await page.goto("/admin/projects");
  const list = page.getByRole("region", { name: "Today" });
  const row = list.getByRole("listitem").filter({ hasText: `E2E Today vendor-${stamp}` });
  await expect(row).toHaveCount(0);
  await page.goto(`/admin/projects/${id}`);
  await expect(page.getByText(/Client wrote/)).toHaveCount(0);

  // The client writing does count.
  await addMessage(id, { direction: "in" });
  await page.goto("/admin/projects");
  await expect(list.getByRole("listitem").filter({ hasText: `E2E Today vendor-${stamp}` })).toContainText(
    "wrote today, not answered yet",
  );

  // Julian's own mail filed from Gmail, even to the venue, counts as him
  // writing, the same way on the board and on the project page.
  await addMessage(id, {
    direction: "out",
    kind: "imported",
    toAddr: "Riverside Venue <events@venue.test>",
    sentAt: new Date(Date.now() + 1000).toISOString(),
  });
  await page.goto("/admin/projects");
  await expect(list.getByRole("listitem").filter({ hasText: `E2E Today vendor-${stamp}` })).toHaveCount(0);
  await page.goto(`/admin/projects/${id}`);
  await expect(page.getByText(/Client wrote today, you today/)).toBeVisible();
});
