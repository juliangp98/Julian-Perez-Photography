import { test, expect } from "@playwright/test";

// Hammer /api/inquire and expect a 429 once the per-IP bucket is full.
// Limit is 5 per 10 min — we fire 6 and expect the last one to be
// throttled. Uses request.post directly so we don't trigger the full
// Resend send path (dev-mode fallback short-circuits anyway).
test("rate limit: /api/inquire 429s after the bucket is drained", async ({
  request,
}) => {
  const payload = {
    name: "Rate Limit Test",
    email: "rate@example.com",
    service: "weddings",
    message: "rate limit test",
  };

  // Use a unique forwarded-for IP so this test's bucket is isolated
  // from other tests (they all run against localhost otherwise).
  const headers = { "x-forwarded-for": "10.99.1.1" };

  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const res = await request.post("/api/inquire", { data: payload, headers });
    statuses.push(res.status());
  }

  // First 5 should be 200 (dev-mode ok), 6th should be 429.
  expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
  expect(statuses[5]).toBe(429);
});
