import { test, expect } from "@playwright/test";
import { advanceToLastSection } from "./support/questionnaire";

// A6/C4 — every bundled service's questionnaire ends with the same generated
// "Related sessions" prompt, listing the OTHER services in its bundle group.
// To reach that final section without coupling to the exact schema, the shared
// details are prefilled via URL and a generic filler satisfies whatever
// required date / radio gates each intermediate section has, then advances.

test("questionnaire: a bundled service ends with the consistent bundle prompt", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.99.22.1" });
  const params = new URLSearchParams({
    fullName: "Bundle Prompt Test",
    email: "bundle-prompt@example.com",
    phone: "(703) 555-7777",
    bookingStatus: "I'm already booked, let's plan",
    package: "Still deciding",
  });
  await page.goto(`/questionnaire/maternity?${params.toString()}`);

  await advanceToLastSection(page);

  await expect(
    page.getByRole("heading", { name: "Related sessions" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Interested in adding any of these/i),
  ).toBeVisible();
  // A maternity bundle sibling renders as an option.
  await expect(page.getByText(/Newborn/i).first()).toBeVisible();
});

test("questionnaire: a non-bundled service has no bundle prompt", async ({
  page,
}) => {
  // Graduation isn't in any bundle group, so it never gets the section.
  await page.goto("/questionnaire/graduation");
  await expect(page.getByText("Related sessions")).toHaveCount(0);
});
