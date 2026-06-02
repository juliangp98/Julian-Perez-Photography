import { test, expect } from "@playwright/test";

// Auth-guard coverage for the client portal. The full happy loop (request a
// real link → verify → session) needs a configured `clients` dataset with a
// seeded record, so it's exercised manually / deferred to a scratch-dataset
// e2e. These cover everything reachable without the store: the login page, the
// middleware gate, invalid-token handling, and the anti-enumeration response.

test("portal: login page renders the email form", async ({ page }) => {
  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("portal: protected page without a session redirects to login", async ({
  page,
}) => {
  await page.goto("/portal/dashboard");
  // Middleware bounces unauthenticated visitors back to /portal.
  await expect(page).toHaveURL(/\/portal(\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("portal: a project detail page without a session redirects to login", async ({
  page,
}) => {
  // Per-project routes live under /portal/projects/:id and are gated the same
  // way as the dashboard — an unauthenticated visitor is bounced to /portal.
  await page.goto("/portal/projects/any-id");
  await expect(page).toHaveURL(/\/portal(\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("portal: an invalid magic token redirects to login with an error", async ({
  page,
}) => {
  await page.goto("/portal/verify?token=not-a-real-token");
  await expect(page).toHaveURL(/\/portal\?error=invalid-link/);
  // Target the message text directly — Next's route-announcer also carries
  // role="alert", which would trip strict mode on a getByRole lookup.
  await expect(
    page.getByText(/invalid or has expired/i),
  ).toBeVisible();
});

test("portal: request-link returns a uniform response (no enumeration)", async ({
  request,
}) => {
  const res = await request.post("/api/portal/request-link", {
    headers: { "x-forwarded-for": "10.99.8.1" },
    data: { email: "definitely-not-a-client@example.com", hp_company: "" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  // With the store unconfigured (no matching record), no link is generated —
  // and the response never reveals that.
  expect(json.devLink).toBeUndefined();
  expect(json.message).toMatch(/if that email matches/i);
});

test("portal: update rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/portal/update", {
    headers: { "x-forwarded-for": "10.99.8.2" },
    data: { phone: "555-1212" },
  });
  expect(res.status()).toBe(401);
});

test("portal: attach-document rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/portal/attach-document", {
    headers: { "x-forwarded-for": "10.99.8.3" },
    data: {
      url: "https://example.public.blob.vercel-storage.com/portal/x.pdf",
      label: "x.pdf",
    },
  });
  expect(res.status()).toBe(401);
});
