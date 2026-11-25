import { test, expect } from "@playwright/test";

// Guard-path coverage for /api/questionnaire. The honeypot, a missing or
// unknown service, and missing required fields all return before the route
// captures a client record, so none of these writes to the store. A valid
// submission would create a client record (on the test store, the suite's
// reset clears it).

test("questionnaire: honeypot (hp_company) triggers a silent success", async ({
  request,
}) => {
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.1" },
    data: { service: "weddings", hp_company: "bot-filled", answers: {} },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
});

test("questionnaire: a stray `company` key is NOT treated as the honeypot", async ({
  request,
}) => {
  // The honeypot key is hp_company (matching the form's hidden input + the
  // inquiry route). A value under `company` must be ignored — so it falls
  // through to normal required-field validation (here, 400) rather than a silent
  // honeypot success. Guards the form/route key-alignment from regressing.
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.5" },
    data: { service: "weddings", company: "bot-filled", answers: {} },
  });
  expect(res.status()).toBe(400);
});

test("questionnaire: missing service → 400", async ({ request }) => {
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.2" },
    data: { answers: {} },
  });
  expect(res.status()).toBe(400);
});

test("questionnaire: unknown service slug → 400", async ({ request }) => {
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.3" },
    data: { service: "not-a-real-service", answers: {} },
  });
  expect(res.status()).toBe(400);
});

test("questionnaire: missing required fields → 400 (not a 500)", async ({
  request,
}) => {
  // An empty answers object should fail required-field validation cleanly —
  // never reach (or crash in) the capture code that runs after a valid submit.
  const res = await request.post("/api/questionnaire", {
    headers: { "x-forwarded-for": "10.99.7.4" },
    data: { service: "weddings", answers: {} },
  });
  expect(res.status()).toBe(400);
  const text = await res.text();
  expect(text.toLowerCase()).toContain("missing required field");
});
