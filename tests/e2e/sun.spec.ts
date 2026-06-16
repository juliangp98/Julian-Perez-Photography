import { test, expect } from "@playwright/test";

// /api/sun suggests the golden-hour session time for a wedding from the event
// date + venue. With GOOGLE_PLACES_API_KEY blanked in the test env
// (playwright.config.ts), geocoding returns null, so the route soft-fails to
// `sessionTime: null` rather than making a live, billable Google call — the
// questionnaire's auto-fill simply no-ops and the field stays manual.

test("sun: rejects a malformed body with 400", async ({ request }) => {
  const res = await request.post("/api/sun", {
    headers: { "x-forwarded-for": "10.91.0.1" },
    data: { address: "x", date: "nope" },
  });
  expect(res.status()).toBe(400);
});

test("sun: a well-formed request soft-fails to null without a key", async ({
  request,
}) => {
  const res = await request.post("/api/sun", {
    headers: { "x-forwarded-for": "10.91.0.2" },
    data: { address: "The Wharf, Washington, DC", date: "2026-10-10" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.sessionTime).toBeNull();
});
