import { test, expect, type APIRequestContext } from "@playwright/test";

// AI next-action nudges (/api/admin/next-action). On a project, the owner can
// ask for the single best next step, reasoned from the project's pipeline state
// server-side (status, history, days elapsed, event proximity, what's missing),
// optionally pointing at a fitting email template. Admin-gated and rate-limited,
// and never auto-runs.
//
// AI is unconfigured in this environment (no GROQ_API_KEY), so a well-formed
// authenticated request is accepted but no-ops (`suggested: false`).

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("next-action: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/next-action", {
    headers: { "x-forwarded-for": "10.99.13.1" },
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(401);
});

test("next-action: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.13.2");
  // Missing projectId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/next-action", {
    data: {},
  });
  expect(res.status()).toBe(400);
});

test("next-action: accepts a well-formed request, no-ops without an AI key", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.13.3");
  const res = await request.post("/api/admin/next-action", {
    data: { projectId: "p1" },
  });
  // No AI key here → the route accepts the request and reports no suggestion
  // rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.suggested).toBe(false);
});
