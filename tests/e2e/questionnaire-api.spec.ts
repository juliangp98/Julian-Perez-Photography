import { test, expect, hasTestStore } from "./support/fixtures";
import { patchProject, readProject } from "./support/test-store";

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
  // From its own address, so a rerun on a server still up stays under the
  // submission limit.
  const other = await request.post("/api/questionnaire", {
    data: portraiture(`e2e-q-other-${Date.now()}@example.com`, prospect.id),
    headers: { "x-forwarded-for": `10.251.${Math.floor(Math.random() * 250)}.1` },
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

// The answers are saved before the owner's alert goes, so the alert links to
// the project, and they stay saved if the alert can't go out.
test("questionnaire: the alert links to the project the answers were saved on, and a failed alert loses nothing", async ({
  request,
  adminRequest,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const email = `e2e-q-alert-${Date.now()}@example.com`;
  const res = await adminRequest.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Questionnaire", serviceType: "portraiture", force: true },
  });
  const id = (await res.json()).id as string;

  expect((await request.post("/api/questionnaire", { data: portraiture(email, id) })).status()).toBe(200);
  const alert = (await fakes.calls("resend")).find(
    (c) => c.path === "/emails" && [c.body?.to].flat().includes("owner@example.com"),
  );
  expect(String(alert?.body?.text)).toContain(`Open the project: `);
  expect(String(alert?.body?.text)).toContain(`/admin/projects/${id}`);
  expect(String(alert?.body?.html)).toContain(`/admin/projects/${id}`);
  expect(String(alert?.body?.text)).not.toContain("named another project");
  // The client's text is in Julian's voice.
  const sms = (await fakes.calls("twilio")).find((c) => c.body?.To === "+17035550177");
  expect(sms?.body?.Body).toBe(
    "Thanks, E2E. Your portrait session questionnaire is in my inbox. I'll read it and reply within 48 hours. Julian",
  );

  // Every try of the alert fails: the visitor hears so, and the answers are kept.
  await patchProject(id, { questionnaire_snapshot: null });
  await fakes.script({ emailFailures: 3 });
  const failed = await request.post("/api/questionnaire", { data: portraiture(email, id) });
  expect(failed.status()).toBe(500);
  expect((await readProject(id, "questionnaire_snapshot")).questionnaire_snapshot).toBeTruthy();
});
