import { test, expect, hasTestStore } from "./support/fixtures";

// Persist a reviewed alt-text override (/api/admin/save-alt). Admin-gated and
// rate-limited. With the test store a well-formed save is written (to an
// e2e-only image path, which the suite's reset clears); without a store it's
// accepted and answers `saved: false`.

test("save-alt: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/save-alt", {
    headers: { "x-forwarded-for": "10.99.19.1" },
    data: { src: "/portfolio/weddings/one.jpg", alt: "A couple at sunset." },
  });
  expect(res.status()).toBe(401);
});

test("save-alt: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing `alt` — a schema violation (400), proving the session was accepted.
  const res = await request.post("/api/admin/save-alt", {
    data: { src: "/portfolio/weddings/one.jpg" },
  });
  expect(res.status()).toBe(400);
});

test("save-alt: accepts a well-formed save, and saves it when there's a store", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/save-alt", {
    data: { src: "/portfolio/e2e/sample.jpg", alt: "A couple at sunset." },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.saved).toBe(hasTestStore);
});
