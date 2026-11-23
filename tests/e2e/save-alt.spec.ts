import { test, expect } from "./support/fixtures";

// Persist a reviewed alt-text override (/api/admin/save-alt). Admin-gated and
// rate-limited. The override store is blanked in the test env (see
// playwright.config.ts), so a well-formed save cleanly no-ops with
// `saved: false` — deterministic and never touches a real database.

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

test("save-alt: accepts a well-formed save, no-ops when the store is unconfigured", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/save-alt", {
    data: { src: "/portfolio/weddings/one.jpg", alt: "A couple at sunset." },
  });
  // Store blanked in the test env → accepted but not persisted.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.saved).toBe(false);
});
