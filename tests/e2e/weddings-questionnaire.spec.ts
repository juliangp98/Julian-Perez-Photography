import { test, expect } from "@playwright/test";

// Exercises the conditional-reveal fields added to the weddings
// questionnaire (style preference + the four other gap sections). All
// five additions share the same `showIf` engine, so validating the
// style section's "Other → free text" reveal end-to-end gives
// confidence the pattern is wired correctly through the renderer; the
// vendor / engagement / weather / sharing reveals use identical
// mechanics on fields deeper in the flow.
//
// Navigates the first four sections (details → about → booking →
// style), filling required fields to advance. Mirrors the
// section-walking pattern in wedding-films-questionnaire.spec.ts.

test("weddings questionnaire: style 'Other' reveals a free-text field", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.6.1" });
  await page.goto("/questionnaire/weddings");

  // Section 1 — Your details
  await page.getByLabel("Your full name").fill("Style Test");
  await page.getByLabel("Email address").fill("style-e2e@example.com");
  await page.getByLabel("Phone number").fill("(703) 555-0001");
  await page.getByRole("button", { name: /Next →/ }).click();

  // Section 2 — About the two of you
  await page.getByLabel(/Your partner's full name/).fill("Partner Test");
  await page.getByRole("button", { name: /Next →/ }).click();

  // Section 3 — Booking status (radio + package select + date)
  await page
    .getByRole("radio", { name: /already booked/i })
    .check();
  await page.getByLabel(/Which package/).selectOption("Premium");
  await page.getByLabel(/Date of your event/).fill("2027-06-12");
  await page.getByRole("button", { name: /Next →/ }).click();

  // Section 4 — Your photography style. The free-text field is hidden
  // until "Other" is selected.
  await expect(
    page.getByRole("heading", { name: "Your photography style" }),
  ).toBeVisible();
  await expect(
    page.getByLabel(/Tell me more about the style/),
  ).toHaveCount(0);

  await page.getByRole("radio", { name: "Other" }).check();

  await expect(
    page.getByLabel(/Tell me more about the style/),
  ).toBeVisible();
});
