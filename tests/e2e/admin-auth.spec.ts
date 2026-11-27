import { test, expect, magicLinkFor, ADMIN_EMAIL } from "./support/fixtures";

// Admin area auth. Unlike the client portal (which needs a seeded record to
// sign in), admin sign-in only requires the ADMIN_EMAIL match — so the full
// magic-link loop is testable end-to-end here. The webServer sets
// ADMIN_EMAIL=admin@example.com (see playwright.config.ts).

test("admin: login page renders the email form", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Owner sign-in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("admin: protected page without a session redirects to login", async ({
  page,
}) => {
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Owner sign-in" })).toBeVisible();
});

test("admin: invalid magic token redirects to login with an error", async ({
  page,
}) => {
  await page.goto("/admin/verify?token=not-a-real-token");
  await expect(page).toHaveURL(/\/admin\?error=invalid-link/);
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
});

test("admin: request-link reveals nothing for a non-admin email", async ({
  request,
  fakes,
}) => {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": "10.99.9.1" },
    data: { email: "not-the-owner@example.com", hp_company: "" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.devLink).toBeUndefined();
  // And no email went out.
  expect(await fakes.calls("resend")).toHaveLength(0);
});

test("admin: update rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/update", {
    headers: { "x-forwarded-for": "10.99.9.2" },
    data: { id: "x", fields: { status: "booked" } },
  });
  expect(res.status()).toBe(401);
});

test("admin: full sign-in loop reaches the projects dashboard", async ({
  page,
  request,
}) => {
  // 1. Request a link for the configured admin email; it arrives by email.
  await request.post("/api/admin/request-link", {
    data: { email: ADMIN_EMAIL, hp_company: "" },
  });

  // 2. Follow the link → sets the admin session and redirects to /admin/projects.
  await page.goto(await magicLinkFor(ADMIN_EMAIL));
  await expect(page).toHaveURL(/\/admin\/projects$/);

  // 3. The dashboard renders (store-agnostic — the heading is always present
  //    whether or not the Supabase store is configured in this environment).
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();

  // The admin area now uses the same unified portal nav as the client side: one
  // Section bar with the admin tabs (Projects active) + an integrated Sign out.
  await expect(
    page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Projects" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // 4. The Links page is reachable once signed in. 30s timeout: under the
  //    dev server the first navigation to this route triggers a cold compile
  //    that can outlast the configured assertion window on a fresh suite run.
  const nav = page.getByRole("navigation", { name: "Section" });
  await expect(nav.getByRole("link")).toHaveText(["Projects", "Content", "Links"]);
  await nav.getByRole("link", { name: "Links", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Links", level: 1, exact: true }),
  ).toBeVisible({ timeout: 30_000 });
});

test("admin: logout is POST-only — a prefetch GET cannot end the session", async ({
  page,
  request,
}) => {
  // Sign in.
  await request.post("/api/admin/request-link", {
    data: { email: ADMIN_EMAIL, hp_company: "" },
  });
  await page.goto(await magicLinkFor(ADMIN_EMAIL));
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();

  // A GET to the logout route — exactly what a `<Link>` prefetch would send —
  // must NOT clear the session. The route is POST-only, so it answers 405.
  const getLogout = await page.request.get("/admin/logout", {
    maxRedirects: 0,
  });
  expect(getLogout.status()).toBe(405);

  // Still authenticated after the prefetch-style GET.
  await page.goto("/admin/projects");
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();

  // A deliberate POST actually signs out (303 back to the login).
  const postLogout = await page.request.post("/admin/logout", {
    maxRedirects: 0,
  });
  expect(postLogout.status()).toBe(303);

  // Now unauthenticated — the dashboard bounces to the admin login.
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/admin$/);
});
