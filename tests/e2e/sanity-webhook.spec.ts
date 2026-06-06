import { test, expect } from "@playwright/test";

// The Sanity → Next revalidation webhook is HMAC-signed. A request without a
// valid signature must NEVER trigger revalidation — it's rejected with 401
// (when SANITY_WEBHOOK_SECRET is configured) or 500 (when it isn't). Either way
// it's never a 200, so an attacker with only the URL can't force cache busts.

test("sanity-webhook: rejects a request with no signature header", async ({
  request,
}) => {
  const res = await request.post("/api/sanity-webhook", {
    headers: { "x-forwarded-for": "10.99.23.1" },
    data: { _type: "serviceCategory", slug: "weddings" },
  });
  expect(res.status()).not.toBe(200);
  expect([401, 500]).toContain(res.status());
});

test("sanity-webhook: rejects a request with a bogus signature", async ({
  request,
}) => {
  const res = await request.post("/api/sanity-webhook", {
    headers: {
      "x-forwarded-for": "10.99.23.2",
      "sanity-webhook-signature": "t=1,v1=not-a-real-signature",
    },
    data: { _type: "serviceCategory", slug: "weddings" },
  });
  expect(res.status()).not.toBe(200);
  expect([401, 500]).toContain(res.status());
});
