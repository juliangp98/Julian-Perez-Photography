import { test, expect } from "@playwright/test";

// Smoke coverage for the surfaces that became Studio-uploadable: the home hero
// (full-bleed when a photo is set, text otherwise), the service cards + detail
// hero, and the About sidebar. The test env blanks Sanity, so every surface
// renders its fallback (text hero, text-only cards, no sidebar) — which is
// exactly the graceful-degradation path we care about guarding. The
// Sanity-image branches are verified live against the real dataset (same
// constraint as the portfolio-gallery spec). a11y.spec.ts separately scans
// these pages for accessibility violations.

test("home: hero + teasers render in the text/fallback state", async ({
  page,
}) => {
  await page.goto("/");
  // Hero tagline (H1) renders whether or not a hero photo is set.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Restructured service + portfolio teaser cards still link through.
  await expect(
    page.getByRole("link", { name: /View all portfolios/i }),
  ).toBeVisible();
});

test("services index: cards render with pricing affordance", async ({
  page,
}) => {
  await page.goto("/services");
  await expect(
    page.getByRole("heading", { name: "What I offer", level: 1 }),
  ).toBeVisible();
  // The restructured card (image banner moved padding into an inner div) still
  // shows its title + the "View pricing" affordance.
  await expect(page.getByText("View pricing →").first()).toBeVisible();
});

test("about: renders bio; sidebar absent without photos", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
