import { test, expect } from "./support/fixtures";

// AI page meta descriptions (/api/admin/draft-meta). The owner picks one of the
// site's key pages and gets an SEO meta description to review and apply to the
// page's metadata — the AI never publishes. Admin-gated and rate-limited.
//
// The "accepted" case uses an unrecognized page key, which the route reports as
// `drafted: false` BEFORE reaching the provider — a clean deterministic no-op
// whether or not an AI key is configured.

test("draft-meta: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-meta", {
    headers: { "x-forwarded-for": "10.99.16.1" },
    data: { page: "home" },
  });
  expect(res.status()).toBe(401);
});

test("draft-meta: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing `page` — a schema violation (400), proving the session was accepted.
  const res = await request.post("/api/admin/draft-meta", {
    data: { angle: "seasonal" },
  });
  expect(res.status()).toBe(400);
});

test("draft-meta: accepts a well-formed request, no-ops for an unknown page", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/draft-meta", {
    data: { page: "not-a-real-page" },
  });
  // Unknown page key → reported as not drafted, before any provider call.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.drafted).toBe(false);
});
