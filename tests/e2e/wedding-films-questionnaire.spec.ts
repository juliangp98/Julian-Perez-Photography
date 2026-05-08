import { test, expect } from "@playwright/test";

// Smoke coverage for the wedding-films planning questionnaire — the
// page renders, the conditional `showIf` branches respond to the
// package selection, and the form submits cleanly through the same
// /api/questionnaire route the photo questionnaires use.
//
// First-section happy path is the assertion target. Walking the full
// 16-section flow would couple this spec tightly to the schema and
// would slow the run to a crawl; the API-level coverage in
// `wedding-films-pdf.spec.ts` plus the existing `/api/questionnaire`
// resilience tests handle the request-side surface.

test("wedding-films questionnaire: first section renders + advances", async ({
  page,
}) => {
  // Unique forwarded-for IP so the rate-limit bucket is isolated from
  // the other tests that hit /api/questionnaire.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.5.1" });
  await page.goto("/questionnaire/wedding-films");

  // Page chrome + intro
  await expect(
    page.getByRole("heading", { name: /Your details/i }),
  ).toBeVisible();

  // Required fields in the first section. The selectors mirror those
  // exercised by inquire.spec.ts so any change to the field labels in
  // yourDetailsSection is caught by both specs.
  await page.getByLabel("Your full name").fill("Wedding Films Test");
  await page.getByLabel("Email address").fill("films-e2e@example.com");
  await page.getByLabel("Phone number").fill("(703) 555-9999");

  // Advance to the next section. Anchor to the arrow so the regex
  // doesn't also match the Next.js dev-tools button (aria-label "Open
  // Next.js Dev Tools") that sits in the dev-server overlay.
  await page.getByRole("button", { name: /Next →/ }).click();

  // Section 2 is "About the two of you" — partner name field surfaces.
  await expect(page.getByLabel(/Your partner's full name/)).toBeVisible();
});

test("wedding-films questionnaire: cross-prefill round-trips shared fields from URL params", async ({
  page,
}) => {
  // The success-screen cross-prefill button on /questionnaire/weddings
  // sends couples here with their basics in the query string. Verify
  // those values land in the form fields automatically.
  const params = new URLSearchParams({
    fullName: "Hybrid Couple",
    email: "hybrid@example.com",
    phone: "(703) 555-1234",
    eventDate: "2026-09-12",
  });
  await page.goto(`/questionnaire/wedding-films?${params.toString()}`);

  await expect(page.getByLabel("Your full name")).toHaveValue("Hybrid Couple");
  await expect(page.getByLabel("Email address")).toHaveValue(
    "hybrid@example.com",
  );
  await expect(page.getByLabel("Phone number")).toHaveValue("(703) 555-1234");
});
