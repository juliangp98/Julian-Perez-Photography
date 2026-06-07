import { test, expect } from "@playwright/test";

// Tab-style section sub-nav above the page title across the public page groups,
// with the active tab marked `aria-current="page"` (gold in the UI).

test("subnav: Portfolio/Services index marks the active tab", async ({
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

test("subnav: category detail pages scope their tabs to that category, with a way back", async ({
  page,
}) => {
  // A service detail page's tabs are that category's own portfolio + pricing
  // (not the top-level index tabs), with pricing active and a back link up to
  // the full services index. This replaced the old top-right cross-link.
  await page.goto("/services/weddings");
  const svcNav = page.getByRole("navigation", { name: "Section" });
  await expect(
    svcNav.getByRole("link", { name: "Weddings pricing" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    svcNav.getByRole("link", { name: "Weddings portfolio" }),
  ).toHaveAttribute("href", "/portfolio/weddings");
  await expect(
    page.getByRole("link", { name: "All services" }),
  ).toHaveAttribute("href", "/services");

  // The portfolio side mirrors it: portfolio active, pricing links across, and
  // a back link up to the portfolio index.
  await page.goto("/portfolio/wedding-films");
  const pfNav = page.getByRole("navigation", { name: "Section" });
  await expect(
    pfNav.getByRole("link", { name: "Wedding Films portfolio" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    pfNav.getByRole("link", { name: "Wedding Films pricing" }),
  ).toHaveAttribute("href", "/services/wedding-films");
  await expect(
    page.getByRole("link", { name: "All portfolios" }),
  ).toHaveAttribute("href", "/portfolio");
});

test("subnav: the booking funnel runs Inquire → Plan → Book", async ({
  page,
}) => {
  // /inquire, the questionnaire, and /book share one funnel bar; the
  // questionnaire is the middle "Plan your session" step.
  await page.goto("/questionnaire");
  const nav = page.getByRole("navigation", { name: "Section" });
  await expect(
    nav.getByRole("link", { name: "Plan your session" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Inquire" })).toHaveAttribute(
    "href",
    "/inquire",
  );
  await expect(nav.getByRole("link", { name: "Book" })).toHaveAttribute(
    "href",
    "/book",
  );
  await expect(nav.getByRole("link", { name: "FAQ" })).toHaveAttribute(
    "href",
    "/faq",
  );

  // /inquire flips the active tab to Inquire.
  await page.goto("/inquire");
  await expect(
    page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Inquire" }),
  ).toHaveAttribute("aria-current", "page");

  // /faq is the final tab in the funnel and marks itself active.
  await page.goto("/faq");
  await expect(
    page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "FAQ" }),
  ).toHaveAttribute("aria-current", "page");
});

test("subnav: the client surfaces share a Portal/Galleries bar (no Plan)", async ({
  page,
}) => {
  // The portal sign-in page (unauthenticated in tests) carries the client bar:
  // Client portal active, with a hop to the galleries. "Plan your session" is
  // intentionally absent — it lives in the booking funnel, so no page sits in
  // two bars.
  await page.goto("/portal");
  const nav = page.getByRole("navigation", { name: "Section" });
  await expect(
    nav.getByRole("link", { name: "Client portal" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Client galleries" }),
  ).toHaveAttribute("href", "/client");
  await expect(
    nav.getByRole("link", { name: "Plan your session" }),
  ).toHaveCount(0);
});
