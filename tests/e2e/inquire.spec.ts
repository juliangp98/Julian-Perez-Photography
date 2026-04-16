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

  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
    timeout: 10_000,
  });
});
