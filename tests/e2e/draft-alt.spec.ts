import { test, expect, type APIRequestContext } from "@playwright/test";

// AI portfolio alt text (/api/admin/draft-alt). The owner picks a gallery image
// and gets accessibility alt text to review and save — the AI never publishes.
// Admin-gated and rate-limited, one image per request.
//
// The "accepted" case names an unknown gallery, which the route reports as
// `drafted: false` BEFORE any provider call (and regardless of whether a vision
// key is configured) — a clean deterministic no-op.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("draft-alt: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-alt", {
    headers: { "x-forwarded-for": "10.99.18.1" },
    data: { slug: "weddings", src: "/portfolio/weddings/one.jpg" },
  });
  expect(res.status()).toBe(401);
});

test("draft-alt: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.18.2");
  // Missing `src` — a schema violation (400), proving the session was accepted.
  const res = await request.post("/api/admin/draft-alt", {
    data: { slug: "weddings" },
  });
  expect(res.status()).toBe(400);
});

test("draft-alt: accepts a well-formed request, no-ops for an unknown gallery", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.18.3");
  const res = await request.post("/api/admin/draft-alt", {
    data: { slug: "not-a-real-gallery", src: "/portfolio/x/one.jpg" },
  });
  // Unknown gallery → reported as not drafted, before any provider call.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.drafted).toBe(false);
});
