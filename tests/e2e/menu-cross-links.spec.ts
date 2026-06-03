import { test, expect } from "@playwright/test";

// The top-level Portfolio and Services index pages cross-link to each other with
// a top-right accent button, mirroring the per-category page cross-links.
test("portfolio index links to services (top-right)", async ({ page }) => {
  await page.goto("/portfolio");
  const link = page.getByRole("link", { name: /View Services/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/services");
});

test("services index links to portfolio (top-right)", async ({ page }) => {
  await page.goto("/services");
  const link = page.getByRole("link", { name: /View Portfolios/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/portfolio");
});
