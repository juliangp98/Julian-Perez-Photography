import { test, expect } from "@playwright/test";

// Tab-style section sub-nav above the page title across the public page groups,
// with the active tab marked `aria-current="page"` (gold in the UI).

test("subnav: Portfolio/Services group marks the active tab", async ({
  page,
}) => {
  await page.goto("/portfolio");
  const nav = page.getByRole("navigation", { name: "Section" });
  await expect(
    nav.getByRole("link", { name: "Portfolio", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Services & Pricing" }),
  ).toBeVisible();

  // The same group on /services flips which tab is active.
  await page.goto("/services");
  await expect(
    page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Services & Pricing" }),
  ).toHaveAttribute("aria-current", "page");
});

test("subnav: detail pages carry the section nav with the right active tab", async ({
  page,
}) => {
  await page.goto("/services/weddings");
  await expect(
    page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Services & Pricing" }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/portfolio/wedding-films");
  await expect(
    page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Portfolio", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("subnav: Clients group surfaces the Client portal tab", async ({
  page,
}) => {
  await page.goto("/questionnaire");
  const nav = page.getByRole("navigation", { name: "Section" });
  await expect(
    nav.getByRole("link", { name: "Client portal" }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Plan your session" }),
  ).toHaveAttribute("aria-current", "page");
});
