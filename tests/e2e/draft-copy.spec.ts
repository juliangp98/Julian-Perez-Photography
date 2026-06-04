import { test, expect, type APIRequestContext } from "@playwright/test";

// AI service/portfolio copy drafting (/api/admin/draft-copy). The owner picks a
// page + a mode (tighten / rewrite / draft fresh) and gets improved tagline /
// description / intro to review and paste into Studio — the AI never publishes.
// Admin-gated and rate-limited.
//
// The "accepted" case uses an unknown subject slug, which the route resolves to
// nothing and reports as `drafted: false` BEFORE reaching the provider — a clean
// deterministic no-op whether or not an AI key is configured.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("draft-copy: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-copy", {
    headers: { "x-forwarded-for": "10.99.15.1" },
    data: { kind: "service", slug: "weddings", mode: "tighten" },
  });
  expect(res.status()).toBe(401);
});

test("draft-copy: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.15.2");
  // Missing `mode` — a schema violation (400), proving the session was accepted.
  const res = await request.post("/api/admin/draft-copy", {
    data: { kind: "service", slug: "weddings" },
  });
  expect(res.status()).toBe(400);
});

test("draft-copy: accepts a well-formed request, no-ops for an unknown subject", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.15.3");
  const res = await request.post("/api/admin/draft-copy", {
    data: {
      kind: "service",
      slug: "this-service-does-not-exist",
      mode: "tighten",
    },
  });
  // Subject doesn't resolve → reported as not drafted, before any provider call.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.drafted).toBe(false);
});
