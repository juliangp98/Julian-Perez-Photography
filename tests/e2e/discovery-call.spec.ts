import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, hasTestStore, type FakeCall } from "./support/fixtures";
import { patchProject, readProject } from "./support/test-store";
import { services } from "../../src/lib/services-data";
import {
  SERVICE_FAMILY,
  discoveryGuide,
  guideFamilies,
  guideFamily,
  guideQuestions,
  knownService,
  tailoredKey,
} from "../../src/lib/discovery-guides";
import { shiftDay, studioToday } from "../../src/lib/field-format";

// The discovery call, on a project's Call tab: a guide per kind of shoot
// (src/lib/discovery-guides.ts) with an answer box under each question and
// free notes, all autosaved; the guide fitted to the client by AI, and saved;
// a summary drafted from the notes, with updates to the project applied only
// when accepted; saving it the first time marks the call held. The guides
// themselves are checked directly; the tab against the test store with the
// fake AI provider.

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
  for (const slug of ["weddings", "newborn", "corporate-headshots", undefined]) {
    const ids = discoveryGuide(slug).sections.map((s) => s.id);
    expect(ids.slice(0, 3), slug).toEqual(["before", "open", "about"]);
    expect(ids.slice(-4), slug).toEqual(["investment", "position", "close", "after"]);
  }
  const asks = (slug: string) => guideQuestions(discoveryGuide(slug)).map((q) => q.question.ask).join("\n");
  // An engagement session isn't asked about the wedding day, or about itself.
  expect(asks("engagements-couples")).not.toMatch(/engagement session appeal|hours of coverage/i);
  // A wedding-film client isn't asked whether they want a film.
  expect(asks("wedding-films")).not.toContain("Any interest in a wedding film");
  // A pet session is asked about a baby only for maternity or a newborn.
  expect(asks("pet")).not.toMatch(/^When is the baby due/m);
  // A couples session opens without assuming an engagement or a wedding.
  const open = (slug: string) => discoveryGuide(slug).sections.find((s) => s.id === "open")?.say?.join(" ");
  expect(open("engagements-couples")).not.toMatch(/congratulations|planning/i);
  expect(open("weddings")).toMatch(/congratulations/i);
});

test("a project with no service, or one the catalog doesn't know, gets the general guide", () => {
  for (const service of [undefined, "", "Not sure yet", "constructor", "__proto__", "toString"]) {
    const guide = discoveryGuide(service);
    expect(guide.family.id, String(service)).toBe("general");
    expect(guideFamily(service).label).toBe("Discovery");
    const text = JSON.stringify(guide);
    expect(text).not.toMatch(/congratulations|the couple|wedding/i);
    // No collections are listed when there's no service.
    expect(text).not.toContain("listed above)");
  }
});

test("a tailored question's answer key comes from the question itself", () => {
  const key = tailoredKey("Is there a rain plan for the garden?");
  expect(key).toMatch(/^tailored\.[0-9a-f]{8}$/);
  expect(tailoredKey("  Is there a rain plan for the garden? ")).toBe(key);
  expect(tailoredKey("Who should I meet before the day?")).not.toBe(key);
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
  const notesSaved = page.waitForResponse(
    (r) => r.url().endsWith("/api/admin/update") && (r.request().postData() ?? "").includes("Wants a relaxed day"),
  );
  await page.getByLabel("My notes").fill("Wants a relaxed day");
  await page.getByLabel("My notes").press("Tab");
  expect((await notesSaved).ok()).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: /^Saved \d{1,2}:\d{2} [AP]M$/ })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("How did you two meet? How long have you been together?")).toHaveValue("College, six years");
  await expect(page.getByLabel("My notes")).toHaveValue("Wants a relaxed day");
});

test("leaving the Call tab and coming back shows the latest notes, and keeps saving", async ({
  adminRequest,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "back");
  await callTab(page, p.id);
  const saved = (text: string) =>
    page.waitForResponse(
      (r) => r.url().endsWith("/api/admin/update") && (r.request().postData() ?? "").includes(text),
    );

  const first = saved("First thoughts");
  await page.getByLabel("My notes").fill("First thoughts");
  await page.getByLabel("My notes").press("Tab");
  expect((await first).ok()).toBe(true);

  // To the Overview, then back again: the browser redraws the Call tab as it
  // was first loaded, and the notes typed since still show.
  await page.getByRole("navigation", { name: "Project" }).getByRole("link", { name: "Overview" }).click();
  await expect(page).not.toHaveURL(/tab=call/);
  await page.goBack();
  await expect(page.getByLabel("My notes")).toHaveValue("First thoughts");

  // And the next change saves on top of them, not over them.
  const second = saved("Second thoughts");
  await page.getByLabel("My notes").fill("First thoughts. Second thoughts");
  await page.getByLabel("My notes").press("Tab");
  expect((await second).status()).toBe(200);
  const row = await readProject(p.id, "calls");
  expect((row.calls as { discovery?: { notes?: string } }).discovery?.notes).toBe("First thoughts. Second thoughts");
});

test("a save typed against an older copy of the notes is refused, unless it's that copy's own", async ({
  adminRequest,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "stale");
  const laptop = "6f0c8a52-0d3e-4c1b-9a77-1f2e3d4c5b6a";
  const phone = "0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9";
  const reopened = "9a8b7c6d-5e4f-4321-8fed-cba987654321";
  const save = (notes: string, base: string, writer?: string, seq?: number) =>
    adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes, base, writer, seq } } });
  const notes = async () =>
    ((await readProject(p.id, "calls")).calls as { discovery?: { notes?: string } }).discovery?.notes;

  expect((await save("From the laptop", "", laptop, 1)).status()).toBe(200);
  // A second window that opened before that save, or a save naming no copy.
  expect((await save("From the phone", "", phone, 1)).status()).toBe(409);
  expect((await save("From somewhere", "")).status()).toBe(409);
  // The laptop retrying that save, its reply lost: still its own.
  const retry = await save("From the laptop, retried", "", laptop, 2);
  expect(retry.status()).toBe(200);
  // The same save arriving twice still lands.
  const again = await save("From the laptop, retried", "", laptop, 2);
  expect(again.status()).toBe(200);
  // Its first try reaching the database after the retry is refused.
  expect((await save("From the laptop", "", laptop, 1)).status()).toBe(409);
  expect(await notes()).toBe("From the laptop, retried");
  // The same window, building on its own save.
  const more = await save("From the laptop, more", (await again.json()).savedAt, laptop, 3);
  expect(more.status()).toBe(200);
  const { savedAt: latest } = await more.json();
  expect(typeof latest).toBe("string");
  // A tab opened after that save is a new copy building on it.
  expect((await save("From a reopened tab", latest, reopened, 1)).status()).toBe(200);
  expect(await notes()).toBe("From a reopened tab");
  // The laptop, now behind the reopened tab, is refused.
  expect((await save("From the laptop, late", latest, laptop, 4)).status()).toBe(409);
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

  const answerSaved = page.waitForResponse(
    (r) => r.url().endsWith("/api/admin/update") && (r.request().postData() ?? "").includes("No rushing"),
  );
  await page.getByLabel("What would make the day feel relaxed to you?").fill("No rushing between photos");
  await page.getByLabel("What would make the day feel relaxed to you?").press("Tab");
  expect((await answerSaved).ok()).toBe(true);
  const before = (await fakes.calls("ai")).length;
  await page.reload();
  await expect(page.getByText("Travel is about an hour each way.")).toBeVisible();
  await expect(page.getByLabel("What would make the day feel relaxed to you?")).toHaveValue("No rushing between photos");
  expect((await fakes.calls("ai")).length).toBe(before);

  // Tailoring again with new questions keeps the answer with its question.
  await fakes.script({
    replies: [JSON.stringify({ ...JSON.parse(tailoring), questions: ["Who is officiating?", "Any family traditions?", "Is the garden covered?"] })],
  });
  await page.getByRole("button", { name: "Tailor again" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tailored." })).toBeVisible();
  await expect(page.getByLabel("Who is officiating?")).toHaveValue("");
  await expect(page.getByText("Answered under another guide")).toBeVisible();
  await expect(page.getByLabel("What would make the day feel relaxed to you?")).toHaveValue("No rushing between photos");
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

  await page.goto(`/admin/projects/${p.id}?tab=details`);
  await expect(page.locator("#project-status")).toHaveValue("in-conversation");
  await expect(page.locator("#a-guests")).toHaveValue("150");
  // A follow-up to send the recap, tomorrow.
  await expect(page.getByText(/: Send the recap and proposal$/)).toBeVisible();
});

test("saving the summary again changes only the summary", async ({ adminRequest }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "resave");
  const summary = (background: string) => ({
    background,
    event: "Garden wedding.",
    priorities: "Candids.",
    logistics: "",
    actions: "",
  });
  const first = await adminRequest.post("/api/admin/update", {
    data: { id: p.id, callSummary: summary("Met at a friend's wedding.") },
  });
  expect(await first.json()).toMatchObject({ held: true, followUp: true });
  const { calls: before } = await readProject(p.id, "calls");
  const heldAt = (before as { discovery: { heldAt: string } }).discovery.heldAt;

  // The recap went out: its own follow-up replaces the call's.
  await patchProject(p.id, { status: "proposal-sent", follow_up_at: "2030-01-07", follow_up_note: "Follow up on the proposal" });
  const again = await adminRequest.post("/api/admin/update", {
    data: { id: p.id, callSummary: summary("Met at a friend's wedding in Leesburg.") },
  });
  expect(await again.json()).toMatchObject({ held: false, followUp: false });
  const row = await readProject(p.id, "status, follow_up_at, follow_up_note, calls");
  expect(row).toMatchObject({ status: "proposal-sent", follow_up_at: "2030-01-07", follow_up_note: "Follow up on the proposal" });
  const call = (row.calls as { discovery: { heldAt: string; summary: { background: string } } }).discovery;
  expect(call.heldAt).toBe(heldAt);
  expect(call.summary.background).toBe("Met at a friend's wedding in Leesburg.");
});

test("Write the recap saves an edited summary, and Back shows it", async ({
  adminRequest,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "recap-back");
  await adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes: "Garden wedding, relaxed" } } });
  await callTab(page, p.id);
  await fakes.script({
    replies: [
      JSON.stringify({ background: "Met in college.", event: "Garden wedding.", priorities: "Candids.", logistics: "", actions: "", updates: {} }),
    ],
  });
  await page.getByRole("button", { name: "Summarize the call" }).click();
  await expect(page.getByLabel(/^Background/)).toHaveValue("Met in college.");
  await page.getByLabel(/^Background/).fill("Met in college, six years ago.");

  await page.getByRole("button", { name: "Write the recap" }).click();
  await expect(page).toHaveURL(/compose=discovery-recap/);
  await page.goBack();
  await expect(page.getByLabel(/^Background/)).toHaveValue("Met in college, six years ago.");
  await expect(page.getByText(/^Call held /)).toBeVisible();
});

test("a recap left unsent opens afresh once the summary changes", async ({ adminRequest, adminPage: page, fakes }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "recap-fresh");
  await adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes: "Garden wedding, relaxed" } } });
  await callTab(page, p.id);
  await fakes.script({
    replies: [
      JSON.stringify({ background: "Met in college.", event: "Garden wedding.", priorities: "Candids.", logistics: "", actions: "", updates: {} }),
    ],
  });
  await page.getByRole("button", { name: "Summarize the call" }).click();
  await expect(page.getByLabel(/^Background/)).toHaveValue("Met in college.");
  await page.getByRole("button", { name: "Write the recap" }).click();
  const body = page.getByLabel("Email body");
  await body.fill("Hi,\n\nMy own words about the garden.\n\nJulian");

  // Back on the Call tab the summary is edited; the recap opens from it, not
  // from the email left unsent.
  await page.getByRole("navigation", { name: "Project" }).getByRole("link", { name: "Call" }).click();
  await page.getByLabel(/^Background/).fill("Met in college, six years ago.");
  await page.getByRole("button", { name: "Write the recap" }).click();
  await expect(page).toHaveURL(/compose=discovery-recap/);
  await expect(body).not.toHaveValue(/My own words about the garden/);
});

test("a recap left unsent opens afresh once an update from the call is accepted", async ({
  adminRequest,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "recap-accept");
  await adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes: "About 150 guests" } } });
  await callTab(page, p.id);
  const drafted = JSON.stringify({
    background: "Met in college.",
    event: "Garden wedding.",
    priorities: "Candids.",
    logistics: "",
    actions: "",
    updates: { guestCount: 150, eventDate: null, venue: null, package: null },
  });
  await fakes.script({ replies: [drafted, drafted] });
  await page.getByRole("button", { name: "Summarize the call" }).click();
  await page.getByRole("button", { name: "Write the recap" }).click();
  await page.getByLabel("Email body").fill("Hi,\n\nWords from before the guest count.\n\nJulian");

  // Back on the Call tab, an update the call suggested is accepted: the recap
  // left unsent was written without it, so the Messages tab opens afresh.
  const tabs = page.getByRole("navigation", { name: "Project" });
  await tabs.getByRole("link", { name: "Call" }).click();
  await page.getByRole("button", { name: "Summarize the call" }).click();
  const suggestion = page.getByRole("listitem").filter({ hasText: "Guest count: 150" });
  await suggestion.getByRole("button", { name: "Accept" }).click();
  await expect(suggestion.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await tabs.getByRole("link", { name: "Messages" }).click();
  await expect(page.getByRole("combobox", { name: "Email template" })).toHaveValue("");
});

test("Summarize says when the AI's answer couldn't be used", async ({ adminRequest, adminPage: page, fakes }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "garbled");
  await adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes: "Loves golden hour" } } });
  await callTab(page, p.id);
  await fakes.script({ replies: ["Not JSON at all."] });
  await page.getByRole("button", { name: "Summarize the call" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't read the AI's answer." })).toBeVisible();
  await expect(page.getByText("Nothing to summarize yet.")).toHaveCount(0);
});

test("a summary sent as lists, with parts left empty, still reads, and a long call has room", async ({
  adminRequest,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "listed");
  await adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes: "Loves golden hour" } } });
  await callTab(page, p.id);
  await fakes.script({
    replies: [
      JSON.stringify({
        background: "Met at a friend's wedding.",
        event: null,
        priorities: ["Candid coverage", "An album"],
        actions: ["Send the proposal", "- Book the venue walkthrough"],
        updates: null,
      }),
    ],
  });
  await page.getByRole("button", { name: "Summarize the call" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Drafted from your notes" })).toBeVisible();
  await expect(page.getByLabel(/^Background/)).toHaveValue("Met at a friend's wedding.");
  await expect(page.getByLabel(/^Photography priorities/)).toHaveValue("- Candid coverage\n- An album");
  await expect(page.getByLabel(/^My action items/)).toHaveValue("- Send the proposal\n- Book the venue walkthrough");
  await expect(page.getByLabel(/^Budget and logistics/)).toHaveValue("");
  // Each part says how far it travels.
  await expect(page.getByLabel("Background (can shape client emails)")).toBeVisible();
  await expect(page.getByLabel("My action items (guides the drafts, never quoted)")).toBeVisible();
  await expect(page.getByLabel("Budget and logistics (yours only)")).toBeVisible();
  // Room for five parts, and on a model that reasons apart from its answer,
  // room for that too, with its reasoning kept short.
  const asked = (await fakes.calls("ai")).filter((c) => c.path === "/chat/completions").at(-1);
  const reasons = /gpt-oss/.test(String(asked?.body?.model));
  expect(asked?.body?.max_tokens).toBe(reasons ? 3500 : 2000);
  if (reasons) expect(asked?.body?.reasoning_effort).toBe("low");
});

test("a summary no model had room to begin says so, rather than that there's nothing to summarize", async ({
  adminRequest,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "no-room");
  await adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes: "Loves golden hour" } } });
  await fakes.script({ cutOff: ["openai/gpt-oss-120b", "qwen/qwen3-32b", "llama-3.1-8b-instant", "qwen/qwen3.6-27b"] });
  const res = await adminRequest.post("/api/admin/ai", { data: { projectId: p.id, kind: "call-summary" } });
  expect(res.status()).toBe(502);
  expect((await res.json()).error).toBe("Couldn't read the AI's answer. Try again.");
});

test("a summary cut off partway says so", async ({ adminRequest, fakes }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "cut-off");
  await adminRequest.post("/api/admin/update", { data: { id: p.id, call: { notes: "Loves golden hour" } } });
  await fakes.script({ replies: ['{"background": "Met at a friend\'s wedding.", "event": "Garden wed'] });
  const res = await adminRequest.post("/api/admin/ai", { data: { projectId: p.id, kind: "call-summary" } });
  expect(res.status()).toBe(502);
  expect((await res.json()).error).toBe("Couldn't read the AI's answer. Try again.");
});

test("Summarize with nothing typed says so, without asking the AI", async ({
  adminRequest,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const p = await newProject(adminRequest, "empty");
  await callTab(page, p.id);
  await page.getByRole("button", { name: "Summarize the call" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Nothing to summarize yet." })).toBeVisible();
  expect(await fakes.calls("ai")).toEqual([]);
});

test("the recap draft reads the summary's client parts and acts on the to-dos, never the budget", async ({
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
  // The to-do list guides the draft, under its own heading, never quoted.
  const user = String(
    (((await fakes.calls("ai")).at(-1)?.body?.messages ?? []) as { role: string; content: string }[]).find(
      (m) => m.role === "user",
    )?.content,
  );
  const guidance = user.indexOf("Julian's own to-do list from the call");
  expect(guidance).toBeGreaterThan(-1);
  expect(user.indexOf("Chase the venue contract")).toBeGreaterThan(guidance);
  expect(user).toContain("never quote the list");
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

  // The same client's own project on that date isn't a clash.
  const film = await adminRequest.post("/api/admin/create-project", {
    data: { email: lead.email, clientName: "E2E Call", serviceType: "wedding-films", force: true },
  });
  const { id: filmId } = await film.json();
  await patchProject(filmId, { status: "contract-signed", event_date: day, project_name: "E2E Their Film" });
  await callTab(page, lead.id);
  await expect(page.getByText(/Also theirs on this date: E2E Their Film/)).toBeVisible();
  await expect(page.getByText(/^This date:/)).not.toContainText("E2E Their Film");
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

test("the guide families list every service once, in order, without the general guide", () => {
  const families = guideFamilies();
  expect(families.flatMap((f) => f.services)).toEqual(Object.keys(SERVICE_FAMILY));
  expect(families[0].family.id).toBe("couples");
  expect(families.map((f) => f.family.id)).not.toContain("general");
  for (const { family, services } of families) {
    for (const s of services) expect(guideFamily(s).id, s).toBe(family.id);
  }
  // A slug the catalog doesn't know, or an inherited key, isn't a service.
  for (const v of ["", "nope", "constructor", "__proto__", undefined]) expect(knownService(v), String(v)).toBeUndefined();
});
