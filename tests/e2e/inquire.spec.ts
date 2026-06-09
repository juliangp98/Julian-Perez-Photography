import { test, expect } from "@playwright/test";

// Submits the public inquiry form and asserts the success screen. Relies
// on the API route's dev-mode fallback (no RESEND_API_KEY -> console log
// + { ok: true, dev: true }), which playwright.config.ts ensures.
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
