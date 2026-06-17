import { test, expect, type APIRequestContext } from "@playwright/test";

// Per-project second-photographer access. The admin grants/revokes a
// collaborator email via /api/admin/collaborators; the portal magic-link gate
// then also issues links to collaborator emails. The grant's real visibility
// semantics need a seeded record (the store is blanked here, same constraint as
// portal-auth.spec.ts), so this covers the admin route's auth + validation and
// the uniform portal request-link response. Cross-account read access and the
// owner-only write guarantee are verified manually against real data.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("admin collaborators: rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/admin/collaborators", {
    headers: { "x-forwarded-for": "10.71.0.1" },
    data: { action: "add", projectId: "p1", email: "second@example.com" },
  });
  expect(res.status()).toBe(401);
});

test("admin collaborators: rejects an invalid email when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.71.0.2");
  // A malformed email is a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/collaborators", {
    data: { action: "add", projectId: "p1", email: "not-an-email" },
  });
  expect(res.status()).toBe(400);
});

test("admin collaborators: accepts an add when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.71.0.3");
  const res = await request.post("/api/admin/collaborators", {
    data: {
      action: "add",
      projectId: "p1",
      email: "second@example.com",
      name: "Second Shooter",
      sendInvite: false,
    },
  });
  // Store blanked → helper no-ops, but the route accepts it.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin collaborators: accepts a remove when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.71.0.4");
  const res = await request.post("/api/admin/collaborators", {
    data: { action: "remove", projectId: "p1", email: "second@example.com" },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("portal request-link: stays uniform for a collaborator email", async ({
  request,
}) => {
  // The gate now also considers collaborator access. With the store blanked it
  // can't match, but the anti-enumeration response must stay a uniform 200.
  const res = await request.post("/api/portal/request-link", {
    headers: { "x-forwarded-for": "10.71.0.5" },
    data: { email: "second@example.com", hp_company: "" },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});
