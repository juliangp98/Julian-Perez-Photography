import { test, expect } from "@playwright/test";

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
}) => {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": "10.99.9.1" },
    data: { email: "not-the-owner@example.com", hp_company: "" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.devLink).toBeUndefined();
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
  // 1. Request a link for the configured admin email — dev mode returns it.
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": "10.99.9.3" },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();

  // 2. Follow the link → sets the admin session and redirects to /admin/projects.
  await page.goto(json.devLink);
  await expect(page).toHaveURL(/\/admin\/projects$/);

  // 3. The dashboard renders (store-agnostic — the heading is always present
  //    whether or not the Supabase store is configured in this environment).
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();

  // 4. External-links hub is reachable once authed. 30s timeout: the first
  //    navigation to this route triggers a cold Turbopack compile that can
  //    exceed the default 5s assertion window on a fresh suite run.
  await page.getByRole("link", { name: "External links" }).click();
  await expect(
    page.getByRole("heading", { name: "External links", level: 1 }),
  ).toBeVisible({ timeout: 30_000 });
});

test("admin: logout is POST-only — a prefetch GET cannot end the session", async ({
  page,
  request,
}) => {
  // Sign in.
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": "10.99.9.4" },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const { devLink } = await res.json();
  await page.goto(devLink);
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
