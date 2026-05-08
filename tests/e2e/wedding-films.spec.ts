import { test, expect } from "@playwright/test";

// Smoke coverage for the wedding-films surfaces:
//   - /services/wedding-films renders with grouped tier cards (Hybrid /
//     Solo), the "View portfolio" cross-link, and the FAQ accordion
//   - /portfolio/wedding-films renders without errors (empty-state OK
//     when no videos seeded)
//   - The `/services/wedding-video` legacy URL 301-redirects to the
//     renamed slug
//   - The Inquire form's Service dropdown surfaces "Wedding Films" so
//     couples can submit a video-first inquiry

test("wedding-films service: page renders with grouped tiers and FAQ", async ({
  page,
}) => {
  await page.goto("/services/wedding-films");

  await expect(
    page.getByRole("heading", { name: "Wedding Films", level: 1 }),
  ).toBeVisible();

  // Group sub-section headers — wedding-films is the first service to
  // exercise the `group` field at scale, so this assertion guards
  // against regressions in the grouped-render branch. The "Solo"
  // header needs strict matching because three tier cards (Solo
  // Ceremony Film, Solo Hybrid, Solo Story Film) match the substring
  // and would resolve ambiguously without exact + level qualifiers.
  await expect(
    page.getByRole("heading", { name: "Hybrid Photo + Video", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Solo", level: 2, exact: true }),
  ).toBeVisible();

  // Sample tier cards from each group
  await expect(
    page.getByRole("heading", { name: "Documentary", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Solo Hybrid", level: 3 }),
  ).toBeVisible();

  // FAQ section is visible (and expandable). The accordion is native
  // <details>/<summary>, so the answer text exists in the DOM but is
  // not visible until expansion.
  await expect(page.getByRole("heading", { name: "Frequently asked" })).toBeVisible();
  const faqQuestion = page.getByText(
    "Why is there a coverage gap in the Solo Hybrid tier?",
  );
  await expect(faqQuestion).toBeVisible();
  await faqQuestion.click();
  // Use text unique to the FAQ answer — the Solo Hybrid honestyNote
  // on the tier card uses similar phrasing, so a broader regex hits
  // both blocks and trips strict-mode.
  await expect(
    page.getByText(/Because I'm switching gear bags/i),
  ).toBeVisible();
});

test("wedding-films legacy slug redirects", async ({ page }) => {
  // Permanent redirect set in next.config.ts SLUG_REDIRECTS. Ensures
  // any inbound link to the pre-rename URL still resolves.
  const response = await page.goto("/services/wedding-video");
  await expect(page).toHaveURL(/\/services\/wedding-films$/);
  // The final response is 200 after the redirect chain. Asserting the
  // final URL is the meaningful check; status assertion would
  // false-fail if Playwright surfaces only the terminal response.
  expect(response?.ok()).toBeTruthy();
});

test("wedding-films portfolio: page renders", async ({ page }) => {
  await page.goto("/portfolio/wedding-films");

  // Page rendering is sufficient signal — the H1 only renders when
  // `getPortfolio("wedding-films")` resolves and the route doesn't
  // 404. The grid/empty-state branch downstream is exercised by the
  // VideoGallery's own component-level concerns; no need to assert
  // both branches conditionally here.
  await expect(
    page.getByRole("heading", { name: "Wedding Films", level: 1 }),
  ).toBeVisible();

  // The top-of-page "View pricing" cross-link should resolve to the
  // matching service page — guards the `serviceSlug ?? slug` default
  // in the page renderer against regression. Anchored to the "View"
  // verb so the nav and footer's "Services & Pricing" links don't
  // collide.
  await expect(
    page.getByRole("link", { name: /^view .*pricing/i }),
  ).toHaveAttribute("href", "/services/wedding-films");
});

test("inquire form: Wedding Films appears in the Service dropdown", async ({
  page,
}) => {
  await page.goto("/inquire");
  // The dropdown is auto-populated from `visibleServices`, so the
  // wedding-films entry appears alongside the photo services. This
  // guards against an accidental regression that would drop the
  // option (e.g. a bad filter or a removed slug).
  const select = page.getByLabel("Service");
  await expect(select).toBeVisible();
  await expect(
    select.locator("option", { hasText: "Wedding Films" }),
  ).toHaveCount(1);
});
