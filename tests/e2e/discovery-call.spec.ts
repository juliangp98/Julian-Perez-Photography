import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, hasTestStore, type FakeCall } from "./support/fixtures";
import { patchProject } from "./support/test-store";
import { services } from "../../src/lib/services-data";
import {
  SERVICE_FAMILY,
  discoveryGuide,
  guideQuestions,
} from "../../src/lib/discovery-guides";
import { shiftDay, studioToday } from "../../src/lib/field-format";

// The discovery call, on a project's Call tab: a guide per kind of shoot
// (src/lib/discovery-guides.ts) with an answer box under each question and
// free notes, all autosaved; the guide fitted to the client by AI, and saved;
// a summary drafted from the notes, with updates to the project applied only
// when accepted; saving it marks the call held. The guides themselves are
// checked directly; the tab against the test store with the fake AI provider.

test("every service has a guide, and every guide's answer keys are unique", () => {
  for (const s of services) {
    expect(SERVICE_FAMILY[s.slug], s.slug).toBeTruthy();
    const keys = guideQuestions(discoveryGuide(s.slug)).map((q) => q.key);
    expect(new Set(keys).size, s.slug).toBe(keys.length);
    expect(keys.length, s.slug).toBeGreaterThan(15);
  }
});

test("each family's guide fits its kind of shoot", () => {
  const titles = (slug: string) => discoveryGuide(slug).sections.map((s) => s.title);
  expect(titles("weddings")).toContain("Get to know the couple");
  expect(titles("wedding-films")).toContain("About the film");
  expect(titles("engagements-couples")).toContain("About the session");
  expect(titles("newborn")).toContain("Get to know the family");
  // A business call opens without congratulations.
  const opener = discoveryGuide("corporate-headshots").sections.find((s) => s.id === "open")?.say?.join(" ");
  expect(opener).not.toMatch(/congratulations/i);
  // The shared framework wraps every family.
  for (const slug of ["weddings", "newborn", "corporate-headshots"]) {
    const ids = discoveryGuide(slug).sections.map((s) => s.id);
    expect(ids.slice(0, 3), slug).toEqual(["before", "open", "about"]);
    expect(ids.slice(-4), slug).toEqual(["investment", "position", "close", "after"]);
  }
});

test("call notes: needs the owner's session", async ({ request }) => {
  const res = await request.post("/api/admin/update", {
    data: { id: "p1", call: { notes: "Loves golden hour" } },
  });
  expect(res.status()).toBe(401);
});

test("call notes: an answer must be under a guide's key", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/update", {
    data: { id: "p1", call: { answers: { "not a key": "x" } } },
  });
  expect(res.status()).toBe(400);
});

async function newProject(request: APIRequestContext, tag: string, serviceType = "weddings") {
  const email = `e2e-call-${tag}-${Date.now()}@example.com`;
  const res = await request.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Call", serviceType, eventDate: "2027-09-18", force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  return { id: id as string, email };
}

const callTab = (page: Page, id: string) => page.goto(`/admin/projects/${id}?tab=call`);

test("the Call tab shows the guide for each kind of shoot, without the AI", async ({
  adminRequest,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  for (const [service, heading] of [
    ["weddings", "Get to know the couple"],
    ["newborn", "Get to know the family"],
    ["corporate-headshots", "Get to know the business"],
  ] as const) {
    const p = await newProject(adminRequest, service, service);
    await callTab(page, p.id);
    await expect(page.getByRole("link", { name: "Call", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(heading, { exact: true })).toBeVisible();
    await expect(page.getByText("Investment and expectations", { exact: true })).toBeVisible();
    await expect(page.getByLabel("My notes")).toBeVisible();
  }
  // Opening the tab asked the AI nothing.
  expect(await fakes.calls("ai")).toEqual([]);

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast", "region"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("answers and notes autosave, and survive a reload", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "autosave");
  await callTab(page, p.id);

  await page.getByLabel("How did you two meet? How long have you been together?").fill("College, six years");
  await page.getByLabel("My notes").fill("Wants a relaxed day");
  await expect(page.getByRole("status").filter({ hasText: /^Saved \d{1,2}:\d{2} [AP]M$/ })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("How did you two meet? How long have you been together?")).toHaveValue("College, six years");
  await expect(page.getByLabel("My notes")).toHaveValue("Wants a relaxed day");
});

test("two saves landing together both keep what they wrote", async ({ adminRequest, adminPage: page }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "together");
  const save = (data: Record<string, unknown>) =>
    adminRequest.post("/api/admin/update", { data: { id: p.id, call: data } });
  const results = await Promise.all([
    save({ answers: { "people.how-met": "At a friend's wedding" } }),
    save({ answers: { "event.guest-count": "About 150" } }),
    save({ notes: "Ask about the rain plan" }),
  ]);
  for (const r of results) expect(r.status()).toBe(200);

  await callTab(page, p.id);
  await expect(page.getByLabel("How did you two meet? How long have you been together?")).toHaveValue("At a friend's wedding");
  await expect(page.getByLabel("How many guests: intimate or large?")).toHaveValue("About 150");
  await expect(page.getByLabel("My notes")).toHaveValue("Ask about the rain plan");
});

const tailoring = JSON.stringify({
  glance: "A garden wedding for about 150, planned around a relaxed day.",
  angle: "Lead with candid coverage and calm timeline help.",
  questions: ["What would make the day feel relaxed to you?", "Who should I meet before the day?", "Is there a rain plan for the garden?"],
  internal: "Travel is about an hour each way.",
  openers: { people: "I'd love to hear how a friend's wedding brought you together.", nope: "dropped" },
});

test("the guide fitted to the client is saved, and its questions take answers", async ({
  adminRequest,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "tailor");
  await patchProject(p.id, {
    inquiry_message: "We're planning a garden wedding for about 150. Reach me at 703-555-0190.",
  });
  await callTab(page, p.id);
  await fakes.script({ replies: [tailoring] });
  await page.getByRole("button", { name: "Tailor to this client" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tailored." })).toBeVisible();
  await expect(page.getByText("A garden wedding for about 150, planned around a relaxed day.")).toBeVisible();
  await expect(page.getByText("Travel is about an hour each way.")).toBeVisible();
  await expect(page.getByText("I'd love to hear how a friend's wedding brought you together.")).toBeVisible();

  // The prompt read the inquiry without the phone number.
  const prompt = JSON.stringify((await fakes.calls("ai")).at(-1)?.body);
  expect(prompt).toContain("garden wedding for about 150");
  expect(prompt).not.toContain("555-0190");

  await page.getByLabel("What would make the day feel relaxed to you?").fill("No rushing between photos");
  await expect(page.getByRole("status").filter({ hasText: /^Saved / })).toBeVisible();
  const before = (await fakes.calls("ai")).length;
  await page.reload();
  await expect(page.getByText("Travel is about an hour each way.")).toBeVisible();
  await expect(page.getByLabel("What would make the day feel relaxed to you?")).toHaveValue("No rushing between photos");
  expect((await fakes.calls("ai")).length).toBe(before);
});

test("the summary is drafted from the notes, updates apply when accepted, and saving holds the call", async ({
  adminRequest,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "summary");
  await adminRequest.post("/api/admin/update", {
    data: { id: p.id, call: { answers: { "event.guest-count": "About 150" }, notes: "Budget around $4k" } },
  });
  await callTab(page, p.id);

  await fakes.script({
    replies: [
      JSON.stringify({
        background: "Met at a friend's wedding.",
        event: "Garden wedding, about 150 guests.",
        priorities: "Candid coverage, an album.",
        logistics: "Budget around $4k.",
        actions: "- Send the proposal",
        updates: { guestCount: 150, eventDate: null, venue: null, package: "Not a real package" },
      }),
    ],
  });
  await page.getByRole("button", { name: "Summarize the call" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Drafted from your notes" })).toBeVisible();
  await expect(page.getByLabel(/^Background/)).toHaveValue("Met at a friend's wedding.");
  // A package the service doesn't offer isn't suggested.
  await expect(page.getByText("Not a real package")).toHaveCount(0);

  const suggestion = page.getByRole("listitem").filter({ hasText: "Guest count: 150" });
  await suggestion.getByRole("button", { name: "Accept" }).click();
  await expect(suggestion.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await page.getByRole("button", { name: "Save summary" }).click();
  await expect(page.getByRole("status").filter({ hasText: "The call is marked held" })).toBeVisible();

  await page.goto(`/admin/projects/${p.id}`);
  await expect(page.locator("#a-status")).toHaveValue("in-conversation");
  await expect(page.locator("#a-guests")).toHaveValue("150");
  // A follow-up to send the recap, tomorrow.
  await expect(page.getByText(/: Send the recap and proposal$/)).toBeVisible();
});

test("the recap draft reads the summary's client parts, never the budget or to-dos", async ({
  adminRequest,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "recap");
  await adminRequest.post("/api/admin/update", {
    data: {
      id: p.id,
      callSummary: {
        background: "Met at a friend's wedding.",
        event: "Garden wedding, about 150 guests.",
        priorities: "Candid coverage, an album.",
        logistics: "Budget around $4k.",
        actions: "- Chase the venue contract",
      },
    },
  });
  await fakes.script({ replies: ["Subject: So good talking\n\nHi,\n\nA recap.\n\nJulian"] });
  const res = await adminRequest.post("/api/admin/draft-email", {
    data: { projectId: p.id, templateId: "discovery-recap" },
  });
  expect((await res.json()).drafted).toBe(true);
  const prompt = JSON.stringify((await fakes.calls("ai")).at(-1)?.body);
  expect(prompt).toContain("Met at a friend's wedding.");
  expect(prompt).toContain("Candid coverage, an album.");
  expect(prompt).not.toContain("$4k");
  expect(prompt).not.toContain("Chase the venue contract");
});

test("the date check names a project already booked on the date", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const day = shiftDay(studioToday(), { days: 400 + Math.floor(Math.random() * 300) });
  const booked = await newProject(adminRequest, "booked");
  await patchProject(booked.id, { status: "contract-signed", event_date: day, project_name: "E2E Booked Wedding" });
  const lead = await newProject(adminRequest, "lead");
  await patchProject(lead.id, { event_date: day });

  await callTab(page, lead.id);
  await expect(page.getByText(/This date: Booked: E2E Booked Wedding/)).toBeVisible();
});

test("the owner's inquiry email links to the call guide", async ({ request, fakes }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const res = await request.post("/api/inquire", {
    data: {
      name: "E2E Call Prep",
      email: `e2e-call-prep-${Date.now()}@example.com`,
      service: "weddings",
      message: "Planning a fall wedding.",
    },
  });
  expect(res.status()).toBe(200);
  const owner = (await fakes.calls("resend"))
    .filter((c: FakeCall) => c.path === "/emails" && [c.body?.to].flat().includes("owner@example.com"))
    .at(-1);
  const link = String(owner?.body?.text).match(/Prep for the call: (\S+)/)?.[1] ?? "";
  expect(new URL(link).pathname).toMatch(/^\/admin\/projects\/[0-9a-f-]{36}$/);
  expect(new URL(link).searchParams.get("tab")).toBe("call");
});
