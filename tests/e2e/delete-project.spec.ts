import { test, expect, type APIRequestContext } from "@playwright/test";

// Admin project deletion (/api/admin/delete-project). Owner-gated and
// rate-limited. The store is blanked in the test env, so a well-formed delete
// cleanly no-ops (`ok: true`) without touching a real database.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("delete-project: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/delete-project", {
    headers: { "x-forwarded-for": "10.99.21.1" },
    data: { projectId: "some-id" },
  });
  expect(res.status()).toBe(401);
});

test("delete-project: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.21.2");
  // Missing `projectId` — a schema violation (400), proving the session worked.
  const res = await request.post("/api/admin/delete-project", { data: {} });
  expect(res.status()).toBe(400);
});

test("delete-project: accepts a well-formed request, no-ops on the blanked store", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.21.3");
  const res = await request.post("/api/admin/delete-project", {
    data: { projectId: "00000000-0000-0000-0000-000000000000" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
});
