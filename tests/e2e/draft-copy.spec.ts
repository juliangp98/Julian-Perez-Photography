import { test, expect } from "./support/fixtures";

// AI service/portfolio copy drafting (/api/admin/draft-copy). The owner picks a
// page + a mode (tighten / rewrite / draft fresh) and gets improved tagline /
// description / intro to review and paste into Studio — the AI never publishes.
// Admin-gated and rate-limited.
//
// The "accepted" case uses an unknown subject slug, which the route resolves to
// nothing and reports as `drafted: false` BEFORE reaching the provider — a clean
// deterministic no-op whether or not an AI key is configured.

test("draft-copy: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-copy", {
    headers: { "x-forwarded-for": "10.99.15.1" },
    data: { kind: "service", slug: "weddings", mode: "tighten" },
  });
  expect(res.status()).toBe(401);
});

test("draft-copy: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing `mode` — a schema violation (400), proving the session was accepted.
  const res = await request.post("/api/admin/draft-copy", {
    data: { kind: "service", slug: "weddings" },
  });
  expect(res.status()).toBe(400);
});

test("draft-copy: accepts a well-formed request, no-ops for an unknown subject", async ({ adminRequest: request }) => {
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
