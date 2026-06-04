import { test, expect, type APIRequestContext } from "@playwright/test";

// AI inquiry triage (/api/admin/triage). On a project with an inquiry, the
// owner can request an AI assessment (summary, fit, urgency, key details, a
// suggested reply) built from the inquiry server-side. It is admin-gated and
// rate-limited, and never auto-runs.
//
// AI is unconfigured in this environment (no GROQ_API_KEY), so a well-formed
// authenticated request is accepted but no-ops (`triaged: false`) rather than
// calling a provider — the admin UI then shows no assessment. The auth guard and
// the schema are both reachable.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("triage: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/triage", {
    headers: { "x-forwarded-for": "10.99.10.1" },
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(401);
});

test("triage: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.10.2");
  // Missing projectId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/triage", {
    data: {},
  });
  expect(res.status()).toBe(400);
});

test("triage: accepts a well-formed request, no-ops without an AI key", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.10.3");
  const res = await request.post("/api/admin/triage", {
    data: { projectId: "p1" },
  });
  // No AI key here → the route accepts the request and reports it as not triaged
  // rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.triaged).toBe(false);
});
