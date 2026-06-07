import { test, expect } from "@playwright/test";

// /faq — the consolidated, searchable FAQ directory. Content-only (not AI-
// gated), so these render + filter assertions are deterministic.

test("faq page: renders the directory with questions and filters", async ({
  page,
}) => {
  await page.goto("/faq");

  await expect(
    page.getByRole("heading", {
      name: /frequently asked questions/i,
      level: 1,
    }),
  ).toBeVisible();

  // Search + collection filters are present.
  await expect(page.getByPlaceholder(/search questions/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "All", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeVisible();

  // A known general question renders (its summary is visible while collapsed).
  await expect(page.getByText(/what areas do you serve/i)).toBeVisible();
});

test("faq page: search narrows and clears", async ({ page }) => {
  await page.goto("/faq");
  const search = page.getByPlaceholder(/search questions/i);

  // A nonsense term yields the empty state.
  await search.fill("zzzzz-no-such-question");
  await expect(page.getByText(/no questions match that search/i)).toBeVisible();

  // A real term brings matching questions back.
  await search.fill("travel");
  await expect(page.getByText(/no questions match that search/i)).toHaveCount(0);
  await expect(page.getByText(/what areas do you serve/i)).toBeVisible();
});

test("faq page: filtering to General hides service-only questions", async ({
  page,
}) => {
  await page.goto("/faq");
  await page.getByRole("button", { name: "General", exact: true }).click();
  // A general question stays…
  await expect(page.getByText(/how do i book/i).first()).toBeVisible();
  // …while a wedding-specific question is filtered out.
  await expect(
    page.getByText(/do you include a second photographer/i),
  ).toHaveCount(0);
});

test("faq page: loads at the top (no auto-scroll to the chat)", async ({
  page,
}) => {
  // The docked concierge previously pulled the viewport down to itself on
  // mount. The page should load at the very top regardless of whether the chat
  // is rendered (the fix scrolls the chat's own log container, not the page).
  await page.goto("/faq");
  await expect(
    page.getByRole("heading", {
      name: /frequently asked questions/i,
      level: 1,
    }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeLessThan(50);
});
