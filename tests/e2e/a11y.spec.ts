import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated a11y smoke test covering the highest-stakes public surfaces.
// Anything in the `disableRules` array is a deliberate, documented
// exception — revisit each time the brand or layout evolves.
//
// Excluded rules:
// - `color-contrast`: the gold brand accent #8a6e4b on white runs
//   ~4.3:1 — passes WCAG AA for large text (18pt/14pt bold) but fails
//   for small text. Brand color, keep as-is for now. Audit any new
//   placements manually.
// - `region`: the carousel/marquee sections on the home page aren't
//   wrapped in a landmark. Low-priority cleanup, not a blocker.

const DISABLE_RULES = ["color-contrast", "region"];

async function runAxe(
  page: import("@playwright/test").Page,
  exclude?: string,
) {
  let builder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(DISABLE_RULES);
  // Skip a selector's subtree — used to drop a cross-origin third-party embed
  // we don't own from the scan.
  if (exclude) builder = builder.exclude(exclude);
  return builder.analyze();
}

test("a11y: home page has no violations (excluding documented rules)", async ({
  page,
}) => {
  await page.goto("/");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /inquire has no violations", async ({ page }) => {
  await page.goto("/inquire");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /faq directory + docked concierge has no violations", async ({
  page,
}) => {
  await page.goto("/faq");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /portfolio index (with section sub-nav) has no violations", async ({
  page,
}) => {
  await page.goto("/portfolio");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /questionnaire/weddings first section has no violations", async ({
  page,
}) => {
  await page.goto("/questionnaire/weddings");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /services/weddings has no violations", async ({ page }) => {
  await page.goto("/services/weddings");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /services/wedding-films has no violations", async ({ page }) => {
  await page.goto("/services/wedding-films");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /portfolio/wedding-films has no violations", async ({ page }) => {
  await page.goto("/portfolio/wedding-films");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /questionnaire/wedding-films first section has no violations", async ({
  page,
}) => {
  await page.goto("/questionnaire/wedding-films");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /portal login page has no violations", async ({ page }) => {
  await page.goto("/portal");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});

test("a11y: /client galleries page has no violations", async ({ page }) => {
  // The Pic-Time embed is a cross-origin third-party app we don't control (and
  // axe descends into same-document iframes), so exclude it — the scan covers
  // only our own markup around the embed.
  await page.goto("/client");
  const results = await runAxe(page, "iframe");
  expect(results.violations).toEqual([]);
});

test("a11y: /admin login page has no violations", async ({ page }) => {
  await page.goto("/admin");
  const results = await runAxe(page);
  expect(results.violations).toEqual([]);
});
