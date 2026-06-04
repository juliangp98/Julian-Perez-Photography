import { test, expect, type APIRequestContext } from "@playwright/test";

// AI shoot-prep brief (/api/admin/prep-brief). On a project with a submitted
// questionnaire, the owner can generate a skimmable prep brief (timeline, key
// people, must-have shots, logistics) built from the snapshot server-side. It is
// admin-gated and rate-limited, and never auto-runs.
//
// AI is unconfigured in this environment (no GROQ_API_KEY), so a well-formed
// authenticated request is accepted but no-ops (`generated: false`) rather than
// calling a provider. The auth guard and the schema are both reachable.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("prep-brief: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/prep-brief", {
    headers: { "x-forwarded-for": "10.99.11.1" },
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(401);
});

test("prep-brief: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.11.2");
  // Missing projectId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/prep-brief", {
    data: {},
  });
  expect(res.status()).toBe(400);
});

test("prep-brief: accepts a well-formed request, no-ops without an AI key", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.11.3");
  const res = await request.post("/api/admin/prep-brief", {
    data: { projectId: "p1" },
  });
  // No AI key here → the route accepts the request and reports it as not
  // generated rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.generated).toBe(false);
});
