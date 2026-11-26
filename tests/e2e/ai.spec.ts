import type { APIRequestContext } from "@playwright/test";
import { test, expect, hasTestStore } from "./support/fixtures";
import { patchProject } from "./support/test-store";

// The AI tools on a project, behind one route (/api/admin/ai) chosen by
// `kind`: the inquiry assessment and the shoot brief are saved on the project,
// so its page shows them without asking the AI again; the plan summary is a
// draft for the edit form and isn't saved. The fake provider is scripted with
// the model's answers.
//
// Without the test store, the guards still run: the auth check, the schema and
// an id no project has (accepted, nothing generated).

test("ai: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/ai", { data: { projectId: "p1", kind: "triage" } });
  expect(res.status()).toBe(401);
});

test("ai: rejects a kind it doesn't know", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/ai", { data: { projectId: "p1", kind: "reply" } });
  expect(res.status()).toBe(400);
});

test("ai: an unknown project is accepted and nothing is generated", async ({ adminRequest: request }) => {
  for (const kind of ["triage", "shoot-brief", "plan-summary"]) {
    const res = await request.post("/api/admin/ai", { data: { projectId: "p1", kind } });
    expect(res.status(), kind).toBe(200);
    expect(await res.json(), kind).toEqual({ ok: true, generated: false });
  }
});

const assessment = JSON.stringify({
  summary: "A spring garden wedding for about 90 guests.",
  fit: "good",
  fitReason: "Weddings are the core service.",
  urgency: "medium",
  urgencyReason: "The date is a year out.",
  keyDetails: ["About 90 guests"],
});
const brief = JSON.stringify({
  headline: "E2E AI wedding, May 2 2027, 90 guests",
  sections: [{ heading: "Timeline", bullets: ["Getting ready at 1 PM"] }],
});

async function newProject(request: APIRequestContext, tag: string) {
  const email = `e2e-ai-${tag}-${Date.now()}@example.com`;
  const res = await request.post("/api/admin/create-project", {
    data: { email, clientName: "E2E AI", serviceType: "weddings", eventDate: "2027-05-02", force: true },
  });
  const { id } = await res.json();
  expect(id, "the project was created").toBeTruthy();
  return id as string;
}

test("ai: the assessment and the shoot brief are saved and shown without asking again", async ({
  adminRequest: request,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const id = await newProject(request, "saved");
  await patchProject(id, {
    inquiry_message: "We're planning a spring garden wedding for about 90 guests.",
    questionnaire_snapshot: JSON.stringify({ gettingReady: "Yes", gettingReadyAddress: "12 Garden Lane" }),
  });

  await fakes.script({ replies: [assessment, brief] });
  const triage = await (await request.post("/api/admin/ai", { data: { projectId: id, kind: "triage" } })).json();
  expect(triage).toMatchObject({ generated: true, saved: { result: { fit: "good" } } });
  const shoot = await (await request.post("/api/admin/ai", { data: { projectId: id, kind: "shoot-brief" } })).json();
  expect(shoot).toMatchObject({ generated: true, saved: { result: { headline: JSON.parse(brief).headline } } });

  const before = (await fakes.calls("ai")).length;
  await page.goto(`/admin/projects/${id}`);
  await expect(page.getByText("A spring garden wedding for about 90 guests.", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Assessed /)).toBeVisible();
  await expect(page.getByText("Getting ready at 1 PM")).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-generate brief" })).toBeVisible();
  // Opening the page asked the AI nothing.
  expect((await fakes.calls("ai")).length).toBe(before);

  // Running it again replaces the saved one, and the page says so.
  await fakes.script({
    replies: [JSON.stringify({ ...JSON.parse(assessment), summary: "Second look: a garden wedding." })],
  });
  await page.getByRole("button", { name: "Assess again" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Assessed." })).toBeVisible();
  await expect(page.getByText("Second look: a garden wedding.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Second look: a garden wedding.")).toBeVisible();
});

test("ai: the plan summary is a draft for the form, built without private details", async ({
  adminRequest: request,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const id = await newProject(request, "plan");
  await patchProject(id, {
    budget: "$4,500",
    referral: "venue",
    // A private note in the activity log.
    status_history: [{ kind: "note", status: "new-inquiry", note: "Prefers texts", changedAt: new Date().toISOString() }],
    // The questionnaire opens with the client's contact details.
    questionnaire_snapshot: JSON.stringify({
      fullName: "E2E AI",
      email: "e2e-ai-contact@example.com",
      phone: "(703) 555-0164",
      gettingReady: "Yes",
    }),
  });
  await fakes.script({ replies: ['"A relaxed spring day, planned around golden hour."'] });

  const res = await request.post("/api/admin/ai", { data: { projectId: id, kind: "plan-summary" } });
  expect(await res.json()).toEqual({
    ok: true,
    generated: true,
    summary: "A relaxed spring day, planned around golden hour.",
  });
  const prompt = JSON.stringify((await fakes.calls("ai")).at(-1)?.body);
  expect(prompt).toContain("Event date: May 2, 2027");
  // The answers are there, without the contact details.
  expect(prompt).toContain("Would you like getting-ready coverage?: Yes");
  // No budget, referral, internal note or contact detail.
  for (const hidden of ["$4,500", "Budget", "found Julian", "Prefers texts", "example.com", "555-0164"]) {
    expect(prompt, hidden).not.toContain(hidden);
  }
});

test("ai: an answer the model garbled says so, and saves nothing", async ({
  adminRequest: request,
  adminPage: page,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const id = await newProject(request, "garbled");
  await patchProject(id, { inquiry_message: "Are you free next June?" });
  // The fake's default reply isn't assessment JSON.
  const res = await request.post("/api/admin/ai", { data: { projectId: id, kind: "triage" } });
  expect(res.status()).toBe(502);
  expect((await res.json()).error).toBe("Couldn't read the AI's answer. Try again.");

  await page.goto(`/admin/projects/${id}`);
  await expect(page.getByRole("button", { name: "Assess this inquiry" })).toBeVisible();
  await expect(page.getByText(/^Assessed /)).toHaveCount(0);
});

test("ai: a saved brief says when the client's answers have changed since", async ({
  adminRequest: request,
  adminPage: page,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const id = await newProject(request, "stale");
  await patchProject(id, { questionnaire_snapshot: JSON.stringify({ gettingReady: "Yes" }) });
  await fakes.script({ replies: [brief] });
  await request.post("/api/admin/ai", { data: { projectId: id, kind: "shoot-brief" } });

  await page.goto(`/admin/projects/${id}`);
  await expect(page.getByText("Getting ready at 1 PM")).toBeVisible();
  await expect(page.getByText(/changed their answers since this brief/)).toHaveCount(0);

  // The client resubmits with a different answer.
  await patchProject(id, { questionnaire_snapshot: JSON.stringify({ gettingReady: "No" }) });
  await page.reload();
  await expect(page.getByText(/changed their answers since this brief/)).toBeVisible();
  await fakes.script({ replies: [brief] });
  await page.getByRole("button", { name: "Re-generate brief" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Brief ready." })).toBeVisible();
  await expect(page.getByText(/changed their answers since this brief/)).toHaveCount(0);
});
