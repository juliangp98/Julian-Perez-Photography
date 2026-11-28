import { test, expect, hasTestStore } from "./support/fixtures";
import { patchProject, testStore } from "./support/test-store";

// Submits the public inquiry form and asserts the success screen. The emails
// it sends go to the fake Resend (see playwright.config.ts).
test("inquiry form: fill required fields and submit → success screen", async ({
  page,
}) => {
  // Route all browser requests through a unique forwarded-for IP so
  // this test gets its own rate-limit bucket, isolated from other
  // tests that hit /api/inquire.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.3.1" });
  await page.goto("/inquire");

  await page.getByLabel("Name").fill("E2E Test User");
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Service").selectOption({ index: 1 });
  await page
    .getByLabel("Tell me about your vision")
    .fill("Automated test submission — please ignore.");

  await page.getByRole("button", { name: /Send inquiry/i }).click();

  // 30s (not 10s): the first POST to `/api/inquire` in a Playwright run
  // triggers Turbopack's cold JIT compile of the route, which regularly
  // takes ~9-10s before the handler even executes. A 10s assertion
  // timeout races that compile step and flakes on first-start runs.
  // 30s matches `actionTimeout` in `playwright.config.ts` and leaves
  // headroom inside the test's 60s overall budget.
  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
    timeout: 30_000,
  });
});

// A blank required field is caught client-side: the form points at the offending
// field with an inline message and never submits (no success screen, no POST).
test("inquiry form: a missing required field shows an inline error and blocks submit", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.3.2" });
  await page.goto("/inquire");

  // Everything except the email.
  await page.getByLabel("Name").fill("E2E Test User");
  await page.getByLabel("Service").selectOption({ index: 1 });
  await page
    .getByLabel("Tell me about your vision")
    .fill("Automated test submission — please ignore.");

  await page.getByRole("button", { name: /Send inquiry/i }).click();

  // Field-level error surfaces and the email field is flagged for assistive tech.
  await expect(
    page.getByText("Please enter your email address."),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  // Validation blocked the submit — the success screen never appears.
  await expect(page.getByRole("heading", { name: "Thank you." })).toHaveCount(
    0,
  );
});

// The shared field primitives auto-format on the public inquiry form.
test("inquiry form: phone / budget / date auto-format and a bad email flags", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.3.3" });
  await page.goto("/inquire");

  const phone = page.getByLabel("Phone");
  await phone.fill("7035551234");
  await expect(phone).toHaveValue("(703) 555-1234");

  const date = page.getByLabel("Event date (if known)");
  await date.fill("06152027");
  await expect(date).toHaveValue("06/15/2027");

  const budget = page.getByLabel("Budget");
  await budget.fill("2500");
  await budget.blur();
  await expect(budget).toHaveValue("$2,500");

  const email = page.getByLabel("Email");
  await email.fill("not-an-email");
  await email.blur();
  await expect(
    page.getByText("Please enter a valid email address."),
  ).toBeVisible();
});

// A second inquiry from someone already on the books: on an open project it
// goes on the thread as the client writing (the project keeps its first
// message); after their project was archived or completed it starts a new
// one; a lost lead's project still takes it.
test.describe("a repeat inquiry", () => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");

  // Each from its own address, so a rerun on a server still up stays under
  // the inquiry limit.
  let sent = 0;
  const inquire = (request: import("@playwright/test").APIRequestContext, email: string, message: string) =>
    request.post("/api/inquire", {
      data: { name: "E2E Repeat", email, service: "newborn", message },
      headers: { "x-forwarded-for": `10.253.${Math.floor(Math.random() * 250)}.${++sent}` },
    });
  const projects = async (email: string) => {
    const { data } = await testStore()!
      .from("client_records")
      .select("id, status, inquiry_message")
      .eq("email", email)
      .order("created_at", { ascending: true });
    return (data ?? []) as { id: string; status: string; inquiry_message: string }[];
  };
  const inquiries = async (projectId: string) => {
    const { data } = await testStore()!
      .from("client_messages")
      .select("direction, kind, status, body_text, subject, from_addr")
      .eq("project_id", projectId)
      .eq("kind", "inquiry");
    return data ?? [];
  };

  test("lands on the open project's thread as the client writing", async ({ request }) => {
    const email = `e2e-repeat-${Date.now()}@example.com`;
    expect((await inquire(request, email, "First message.")).status()).toBe(200);
    expect((await inquire(request, email, "Second message, with a question.")).status()).toBe(200);
    const [p, ...rest] = await projects(email);
    expect(rest).toEqual([]);
    expect(p.inquiry_message).toBe("First message.");
    expect(await inquiries(p.id)).toEqual([
      {
        direction: "in",
        kind: "inquiry",
        status: "received",
        body_text: "Second message, with a question.",
        subject: "New inquiry: Newborn & First Year",
        from_addr: email,
      },
    ]);
    // It counts as the client writing last.
    const { data: contact } = await testStore()!
      .from("client_last_contact")
      .select("last_in_at")
      .eq("project_id", p.id)
      .single();
    expect(contact?.last_in_at).toBeTruthy();
    // The first message again stores nothing new, and the repeat sent again
    // (a retry, a double click) is kept once.
    expect((await inquire(request, email, "First message.")).status()).toBe(200);
    expect((await inquire(request, email, "Second message, with a question.")).status()).toBe(200);
    expect(await inquiries(p.id)).toHaveLength(1);
  });

  test("after an archived project it starts a new one, and a lost lead's project takes it", async ({ request }) => {
    const email = `e2e-repeat-closed-${Date.now()}@example.com`;
    await inquire(request, email, "The first time.");
    const [first] = await projects(email);
    await patchProject(first.id, { status: "archived" });

    await inquire(request, email, "Back again.");
    const after = await projects(email);
    expect(after).toHaveLength(2);
    expect(after[1]).toMatchObject({ status: "new-inquiry", inquiry_message: "Back again." });
    expect(await inquiries(first.id)).toEqual([]);

    await patchProject(after[1].id, { status: "lost" });
    await inquire(request, email, "Still interested.");
    expect(await projects(email)).toHaveLength(2);
    expect((await inquiries(after[1].id)).map((m) => m.body_text)).toEqual(["Still interested."]);
  });
});

// A questionnaire sent without a project link lands on the open project for
// that email and service, never on a completed one.
test("a questionnaire without a project link goes to the open project, not last year's", async ({ request }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const email = `e2e-repeat-q-${Date.now()}@example.com`;
  const ip = () => ({ "x-forwarded-for": `10.254.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await request.post("/api/inquire", {
    data: { name: "E2E Again", email, service: "portraiture", message: "Last year." },
    headers: ip(),
  });
  const { data: first } = await testStore()!.from("client_records").select("id").eq("email", email).single();
  await patchProject(first!.id, { status: "complete", questionnaire_snapshot: '{"old":"answers"}' });
  await request.post("/api/inquire", {
    data: { name: "E2E Again", email, service: "portraiture", message: "This year." },
    headers: ip(),
  });
  const res = await request.post("/api/questionnaire", {
    headers: ip(),
    data: {
      service: "portraiture",
      hp_company: "",
      answers: {
        fullName: "E2E Again",
        email,
        phone: "(703) 555-0177",
        bookingStatus: "I'm strongly considering and want an accurate quote",
        package: "Still deciding",
        eventDate: "2027-05-02",
        vibe: "Soft / outdoor / golden hour",
        wardrobeHelp: "No",
        locationPreference: "Outdoor only",
      },
    },
  });
  expect(res.status()).toBe(200);
  const { data: rows } = await testStore()!
    .from("client_records")
    .select("id, questionnaire_snapshot")
    .eq("email", email)
    .order("created_at", { ascending: true });
  expect(rows).toHaveLength(2);
  expect(rows![0].questionnaire_snapshot).toBe('{"old":"answers"}');
  expect(String(rows![1].questionnaire_snapshot)).toContain("Soft / outdoor / golden hour");
});
