import { test, expect, type APIRequestContext } from "@playwright/test";

// AI plan-summary drafting (/api/admin/draft-plan). On a project, the owner can
// draft the client-facing `planSummary` (shown in the portal) from the
// questionnaire answers + booking facts — deliberately NOT from internal notes,
// since the summary is portal-visible. The owner reviews/edits it in the form
// and saves. It is admin-gated and rate-limited.
//
// AI is unconfigured in this environment (no GROQ_API_KEY), so a well-formed
// authenticated request is accepted but no-ops (`drafted: false`).

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("draft-plan: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-plan", {
    headers: { "x-forwarded-for": "10.99.12.1" },
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(401);
});

test("draft-plan: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.12.2");
  // Missing projectId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/draft-plan", {
    data: {},
  });
  expect(res.status()).toBe(400);
});

test("draft-plan: accepts a well-formed request, no-ops without an AI key", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.12.3");
  const res = await request.post("/api/admin/draft-plan", {
    data: { projectId: "p1" },
  });
  // No AI key here → the route accepts the request and reports it as not drafted
  // rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.drafted).toBe(false);
});
