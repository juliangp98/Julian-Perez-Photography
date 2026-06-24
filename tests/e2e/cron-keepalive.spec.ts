import { test, expect } from "@playwright/test";

// Supabase free-tier keep-alive cron. A daily Vercel Cron hits
// /api/cron/keepalive, which runs one trivial count against the client store so
// Postgres never goes idle long enough to auto-pause. The route is guarded by
// CRON_SECRET (Vercel attaches it as a bearer on scheduled runs). The test
// server sets CRON_SECRET to a known value and blanks the Supabase store, so
// the happy path returns the "store-unconfigured" skip rather than touching a
// real database — enough to prove the guard and wiring.

const SECRET = "e2e-cron-secret";

test("keepalive: rejects a request without the cron secret", async ({
  request,
}) => {
  const res = await request.get("/api/cron/keepalive");
  expect(res.status()).toBe(401);
});

test("keepalive: rejects a request with the wrong cron secret", async ({
  request,
}) => {
  const res = await request.get("/api/cron/keepalive", {
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect(res.status()).toBe(401);
});

test("keepalive: accepts a request carrying the cron secret", async ({
  request,
}) => {
  const res = await request.get("/api/cron/keepalive", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  // Store is blanked in the test env, so the ping short-circuits.
  expect(json.skipped).toBe("store-unconfigured");
});
