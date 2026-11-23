import { test, expect } from "./support/fixtures";

// AI plan-summary drafting (/api/admin/draft-plan). On a project, the owner can
// draft the client-facing `planSummary` (shown in the portal) from the
// questionnaire answers + booking facts — deliberately NOT from internal notes,
// since the summary is portal-visible. The owner reviews/edits it in the form
// and saves. It is admin-gated and rate-limited.
//
// No project record resolves here (the store is blank without .env.test), so a
// well-formed authenticated request is accepted but no-ops (`drafted: false`).

test("draft-plan: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-plan", {
    headers: { "x-forwarded-for": "10.99.12.1" },
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(401);
});

test("draft-plan: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing projectId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/draft-plan", {
    data: {},
  });
  expect(res.status()).toBe(400);
});

test("draft-plan: accepts a well-formed request, no-ops without an AI key", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/draft-plan", {
    data: { projectId: "p1" },
  });
  // No record resolves → the route accepts the request and reports it as not drafted
  // rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.drafted).toBe(false);
});
