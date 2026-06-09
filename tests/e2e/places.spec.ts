import { test, expect } from "@playwright/test";

// /api/places/autocomplete proxies Google Places. With GOOGLE_PLACES_API_KEY
// blanked in the test env (playwright.config.ts), it returns an empty list
// rather than calling Google — so a location field degrades to free text and
// the suite never makes a live, billable request.

test("places autocomplete: returns a predictions array (empty without a key)", async ({
  request,
}) => {
  const res = await request.post("/api/places/autocomplete", {
    headers: { "x-forwarded-for": "10.77.0.1" },
    data: { input: "1600 Pennsylvania Ave" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.predictions)).toBe(true);
  expect(json.predictions).toEqual([]);
});

test("places autocomplete: rejects empty input with 400", async ({
  request,
}) => {
  const res = await request.post("/api/places/autocomplete", {
    headers: { "x-forwarded-for": "10.77.0.2" },
    data: { input: "" },
  });
  expect(res.status()).toBe(400);
});
