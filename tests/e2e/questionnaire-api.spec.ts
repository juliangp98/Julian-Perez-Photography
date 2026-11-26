import { test, expect, hasTestStore } from "./support/fixtures";
import { patchProject } from "./support/test-store";

// Coverage for /api/questionnaire. The honeypot, a missing or unknown service,
// and missing required fields all return before the route captures a client
// record, so none of these writes to the store. With the test store, a valid
// submission attaches to its project: a booked project moves on to Planning, a
// prospect keeps its place.

test("questionnaire: honeypot (hp_company) triggers a silent success", async ({
  request,
}) => {
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.1" },
    data: { service: "weddings", hp_company: "bot-filled", answers: {} },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
});

test("questionnaire: a stray `company` key is NOT treated as the honeypot", async ({
  request,
}) => {
  // The honeypot key is hp_company (matching the form's hidden input + the
  // inquiry route). A value under `company` must be ignored — so it falls
  // through to normal required-field validation (here, 400) rather than a silent
  // honeypot success. Guards the form/route key-alignment from regressing.
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.5" },
    data: { service: "weddings", company: "bot-filled", answers: {} },
  });
  expect(res.status()).toBe(400);
});

test("questionnaire: missing service → 400", async ({ request }) => {
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.2" },
    data: { answers: {} },
  });
  expect(res.status()).toBe(400);
});

test("questionnaire: unknown service slug → 400", async ({ request }) => {
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.3" },
    data: { service: "not-a-real-service", answers: {} },
  });
  expect(res.status()).toBe(400);
});

test("questionnaire: missing required fields → 400 (not a 500)", async ({
  request,
}) => {
  // An empty answers object should fail required-field validation cleanly —
  // never reach (or crash in) the capture code that runs after a valid submit.
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.4" },
    data: { service: "weddings", answers: {} },
  });
  expect(res.status()).toBe(400);
  const text = await res.text();
  expect(text.toLowerCase()).toContain("missing required field");
});

// A complete portraiture questionnaire (the shortest one) for this project.
const portraiture = (email: string, project: string) => ({
  service: "portraiture",
  project,
  hp_company: "",
  answers: {
    fullName: "E2E Questionnaire",
    email,
    phone: "(703) 555-0177",
    bookingStatus: "I'm strongly considering and want an accurate quote",
    package: "Still deciding",
    eventDate: "2027-05-02",
    vibe: "Soft / outdoor / golden hour",
    wardrobeHelp: "No",
    locationPreference: "Outdoor only",
  },
});

test("questionnaire: a prospect keeps their status; a booked project moves on to Planning", async ({
  request,
  adminRequest,
  adminPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const make = async (tag: string) => {
    const email = `e2e-q-${tag}-${Date.now()}@example.com`;
    const res = await adminRequest.post("/api/admin/create-project", {
      data: { email, clientName: "E2E Questionnaire", serviceType: "portraiture", force: true },
    });
    return { email, id: (await res.json()).id as string };
  };
  const prospect = await make("prospect");
  await patchProject(prospect.id, { status: "proposal-sent" });
  const booked = await make("booked");
  await patchProject(booked.id, { status: "contract-signed" });

  for (const p of [prospect, booked]) {
    const res = await request.post("/api/questionnaire", { data: portraiture(p.email, p.id) });
    expect(res.status()).toBe(200);
    // The answers went to the project the link named.
    expect((await res.json()).attachedToProject).toBe(true);
  }
  // Another email lands them elsewhere, and the reply says only that.
  const other = await request.post("/api/questionnaire", {
    data: portraiture(`e2e-q-other-${Date.now()}@example.com`, prospect.id),
  });
  expect(other.status()).toBe(200);
  const otherJson = await other.json();
  expect(otherJson.attachedToProject).toBe(false);
  expect(JSON.stringify(otherJson)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);

  await adminPage.goto(`/admin/projects/${prospect.id}`);
  await expect(adminPage.locator("#project-status")).toHaveValue("proposal-sent");
  await adminPage.goto(`/admin/projects/${booked.id}`);
  await expect(adminPage.locator("#project-status")).toHaveValue("planning");
});
