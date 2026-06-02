import { test, expect, type APIRequestContext } from "@playwright/test";

// Bundle linking APIs. A bundle groups two or more of one person's projects
// (e.g. wedding + engagement) under a shared label. Two endpoints write it:
// /api/portal/bundle (the client, on their own projects) and /api/admin/bundle
// (the owner, on any one client's projects).
//
// The portal happy path needs a seeded record to obtain a session, so only its
// auth guard is reachable here (same constraint as portal-auth.spec.ts). Admin
// sign-in needs only ADMIN_EMAIL, so the admin endpoint is testable end-to-end:
// with the store blanked in this environment the helpers no-op, so a
// well-formed authenticated request returns ok without touching a database.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  // Following the link sets jpp_admin_session in this context's cookie jar;
  // subsequent posts from the same `request` fixture carry it.
  await request.get(json.devLink);
}

test("portal bundle: rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/portal/bundle", {
    headers: { "x-forwarded-for": "10.99.7.1" },
    data: { action: "link", projectIds: ["a", "b"], label: "Wedding + Engagement" },
  });
  expect(res.status()).toBe(401);
});

test("admin bundle: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/bundle", {
    headers: { "x-forwarded-for": "10.99.7.2" },
    data: { action: "link", projectIds: ["a", "b"], label: "Maternity + Newborn" },
  });
  expect(res.status()).toBe(401);
});

test("admin bundle: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.7.3");
  // A link needs 2+ project ids — one is a schema violation (400), proving the
  // session was accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/bundle", {
    data: { action: "link", projectIds: ["only-one"], label: "Bundle" },
  });
  expect(res.status()).toBe(400);
});

test("admin bundle: accepts a well-formed link when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.7.4");
  const res = await request.post("/api/admin/bundle", {
    data: {
      action: "link",
      projectIds: ["p1", "p2"],
      label: "Wedding + Engagement",
    },
  });
  // Store is blanked here, so the helper no-ops — but the route accepts the
  // request and returns ok.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin bundle: accepts an unlink when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.7.5");
  const res = await request.post("/api/admin/bundle", {
    data: { action: "unlink", projectId: "p1" },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});
