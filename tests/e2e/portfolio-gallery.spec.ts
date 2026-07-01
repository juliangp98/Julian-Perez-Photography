import { test, expect } from "@playwright/test";

// Smoke coverage for the portfolio gallery surfaces after photos became
// Studio-uploadable. Galleries resolve from the first available source —
// Sanity `gallery[]` → Lightroom manifest → placeholder (see the resolver in
// src/lib/content.ts). The test env blanks Sanity, so these exercise the
// manifest/fallback branch (empty-state OK); the Sanity-gallery branch and the
// cover-thumbnail rendering are verified manually against the live dataset
// (same constraint as the other Sanity-backed specs).

test("portfolio index: renders collections with category cards", async ({
  page,
}) => {
  await page.goto("/portfolio");

  await expect(
    page.getByRole("heading", { name: "Collections", level: 1 }),
  ).toBeVisible();

  // At least one category card links through to a detail page — guards the
  // getPortfoliosByUmbrella → card render path (incl. the cover-thumbnail
  // branch, which falls back to text-only when a gallery has no images).
  await expect(
    page.getByRole("link", { name: /Weddings/i }).first(),
  ).toBeVisible();
});

test("portfolio detail: a photo gallery page renders", async ({ page }) => {
  await page.goto("/portfolio/weddings");

  // H1 only renders when getPortfolio("weddings") resolves and the route
  // doesn't 404. The gallery grid vs. "coming soon" empty-state branch is a
  // downstream concern of the resolver/component; rendering the page is the
  // meaningful smoke signal here.
  await expect(
    page.getByRole("heading", { name: "Weddings", level: 1 }),
  ).toBeVisible();
});
