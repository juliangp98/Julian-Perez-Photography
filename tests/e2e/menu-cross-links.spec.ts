import { test, expect } from "@playwright/test";

// The top-level Portfolio and Services index pages connect to each other through
// the section sub-nav (tab-style links above the page title), which replaced the
// old top-right cross-link buttons.
test("portfolio index links to services via the section nav", async ({
  page,
}) => {
  await page.goto("/portfolio");
  const link = page
    .getByRole("navigation", { name: "Section" })
    .getByRole("link", { name: "Services & Pricing" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/services");
});

test("services index links to portfolio via the section nav", async ({
  page,
}) => {
  await page.goto("/services");
  const link = page
    .getByRole("navigation", { name: "Section" })
    .getByRole("link", { name: "Portfolio", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/portfolio");
});
