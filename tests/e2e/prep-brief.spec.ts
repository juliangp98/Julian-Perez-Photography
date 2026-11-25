import { test, expect } from "./support/fixtures";

// AI shoot-prep brief (/api/admin/prep-brief). On a project with a submitted
// questionnaire, the owner can generate a skimmable prep brief (timeline, key
// people, must-have shots, logistics) built from the snapshot server-side. It is
// admin-gated and rate-limited, and never auto-runs.
//
// No project has the id "p1", so a well-formed authenticated request is
// accepted but no-ops (`generated: false`) rather than calling a provider. The
// auth guard and the schema are both reachable.

test("prep-brief: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/prep-brief", {
    headers: { "x-forwarded-for": "10.99.11.1" },
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(401);
});

test("prep-brief: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing projectId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/prep-brief", {
    data: {},
  });
  expect(res.status()).toBe(400);
});

test("prep-brief: accepts a well-formed request, no-ops without an AI key", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/prep-brief", {
    data: { projectId: "p1" },
  });
  // No record resolves → the route accepts the request and reports it as not
  // generated rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.generated).toBe(false);
});
