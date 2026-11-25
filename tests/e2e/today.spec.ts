import type { APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, hasTestStore } from "./support/fixtures";
import { addMessage, patchProject, readProject } from "./support/test-store";
import { todayRows, type TodayProject, type TodayServiceTerms } from "../../src/lib/today";
import { shiftDay, studioToday } from "../../src/lib/field-format";

// The Today list on the projects board (src/lib/today.ts): what needs the
// owner now, worked out from the projects with rules. The rules are checked
// directly; the board against the test store, where each row can be marked
// handled or snoozed.

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
  // An evening message counts on the studio's day it was sent.
  expect(one({ status: "proposal-sent", lastInAt: "2026-11-25T02:30:00Z" })).toMatchObject([
    { rule: "reply", reason: "The client wrote yesterday, not answered yet", due: "2026-11-24" },
  ]);
});

test("a new inquiry nobody answered shows at any age, due from the day it came", () => {
  expect(one({ status: "new-inquiry" })).toMatchObject([{ rule: "inquiry", action: { label: "Draft a reply" } }]);
  expect(one({ status: "new-inquiry", lastOutAt: "2026-11-24T10:00:00Z" })).toEqual([]);
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

test("a closed project keeps only its follow-up", () => {
  expect(one({ status: "lost", followUpAt: "2026-11-25", holdUntil: "2026-11-20", lastInAt: "2026-11-24T00:00:00Z" })).toMatchObject([
    { rule: "follow-up" },
  ]);
});

async function newProject(request: APIRequestContext, tag: string) {
  const email = `e2e-today-${tag}-${Date.now()}@example.com`;
  const res = await request.post("/api/admin/create-project", {
    data: { email, clientName: `E2E Today ${tag}`, serviceType: "weddings", force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  return id as string;
}

test("the board shows each rule's row, and a reply can be marked handled", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const today = studioToday();
  const stamp = Date.now();
  const replied = await newProject(adminRequest, `reply-${stamp}`);
  await patchProject(replied, { status: "proposal-sent" });
  await addMessage(replied, { direction: "out", sentAt: new Date(Date.now() - 3 * 86_400_000).toISOString() });
  await addMessage(replied, { direction: "in" });
  const held = await newProject(adminRequest, `hold-${stamp}`);
  await patchProject(held, { status: "proposal-sent", hold_until: shiftDay(today, { days: -2 }) });
  const due = await newProject(adminRequest, `follow-${stamp}`);
  await patchProject(due, { follow_up_at: today, follow_up_note: "Check the agreement came in" });
  const done = await newProject(adminRequest, `done-${stamp}`);
  await patchProject(done, { follow_up_at: today, follow_up_note: "Send the timeline" });

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
  // Words in any order, one of them the service.
  await page.getByLabel("Search projects").fill(`weddings search-${stamp}`);
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
