import { test, expect } from "./support/fixtures";

// Admin project deletion (/api/admin/delete-project). Owner-gated and
// rate-limited. The well-formed delete names an id no project has, so it
// answers `ok: true` without removing anything, with or without a store.

test("delete-project: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/delete-project", {
    headers: { "x-forwarded-for": "10.99.21.1" },
    data: { projectId: "some-id" },
  });
  expect(res.status()).toBe(401);
});

test("delete-project: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing `projectId` — a schema violation (400), proving the session worked.
  const res = await request.post("/api/admin/delete-project", { data: {} });
  expect(res.status()).toBe(400);
});

test("delete-project: accepts a well-formed request for a project that doesn't exist", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/delete-project", {
    data: { projectId: "00000000-0000-0000-0000-000000000000" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
});
