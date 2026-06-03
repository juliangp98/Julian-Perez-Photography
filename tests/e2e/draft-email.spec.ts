import { test, expect, type APIRequestContext } from "@playwright/test";

// AI email drafting (/api/admin/draft-email). The owner picks a pipeline
// template on a project and the route returns a personalized draft built from
// the project's server-side facts — which the owner reviews before sending (the
// route never sends). It is admin-gated and rate-limited.
//
// AI is unconfigured in this environment (no AI_API_KEY), so a well-formed
// authenticated request is accepted but no-ops (`drafted: false`) rather than
// calling a provider — the compose UI falls back to the static template. The
// auth guard, the schema, and the template-existence check are all reachable.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("draft-email: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-email", {
    headers: { "x-forwarded-for": "10.99.9.1" },
    data: { projectId: "p1", templateId: "gallery-delivery" },
  });
  expect(res.status()).toBe(401);
});

test("draft-email: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.9.2");
  // Missing templateId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/draft-email", {
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(400);
});

test("draft-email: rejects an unknown template when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.9.3");
  const res = await request.post("/api/admin/draft-email", {
    data: { projectId: "p1", templateId: "not-a-real-template" },
  });
  expect(res.status()).toBe(400);
});

test("draft-email: accepts a well-formed request, no-ops without an AI key", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.9.4");
  const res = await request.post("/api/admin/draft-email", {
    data: {
      projectId: "p1",
      templateId: "gallery-delivery",
      instructions: "warmer tone",
    },
  });
  // No AI key here → the route accepts the request and reports it as not drafted
  // rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.drafted).toBe(false);
});
