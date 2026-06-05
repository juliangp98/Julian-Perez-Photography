import { test, expect } from "@playwright/test";

// Public booking concierge (/api/concierge) — content-grounded, rate-limited,
// honeypot-protected, grounded only in public catalog content. Malformed,
// empty, wrong-last-role, and honeypot cases are deterministic (no provider
// call); the well-formed case depends on whether a key is configured in the
// runner, so it asserts a past-validation status the way draft-journal does.

test("concierge: rejects a non-array messages body", async ({ request }) => {
  const res = await request.post("/api/concierge", {
    headers: { "x-forwarded-for": "10.99.20.1" },
    data: { messages: "not-an-array" },
  });
  expect(res.status()).toBe(400);
});

test("concierge: rejects an empty conversation", async ({ request }) => {
  const res = await request.post("/api/concierge", {
    headers: { "x-forwarded-for": "10.99.20.2" },
    data: { messages: [] },
  });
  expect(res.status()).toBe(400);
});

test("concierge: rejects a conversation that doesn't end on a visitor message", async ({
  request,
}) => {
  const res = await request.post("/api/concierge", {
    headers: { "x-forwarded-for": "10.99.20.3" },
    data: { messages: [{ role: "assistant", content: "Hello there!" }] },
  });
  expect(res.status()).toBe(400);
});

test("concierge: honeypot triggers a silent success with no provider call", async ({
  request,
}) => {
  const res = await request.post("/api/concierge", {
    headers: { "x-forwarded-for": "10.99.20.4" },
    data: {
      messages: [{ role: "user", content: "How much is a wedding?" }],
      hp_company: "a-bot-filled-this",
    },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(typeof json.reply).toBe("string");
});

test("concierge: accepts a well-formed question (past validation)", async ({
  request,
}) => {
  const res = await request.post("/api/concierge", {
    headers: { "x-forwarded-for": "10.99.20.5" },
    data: {
      messages: [
        { role: "user", content: "What wedding packages do you offer?" },
      ],
    },
  });
  // With a key set in the runner this reaches the provider (200, or 502 if the
  // network is unavailable); either way it's past rate-limit + validation.
  expect(res.status()).not.toBe(400);
  expect(res.status()).not.toBe(429);
  expect([200, 502]).toContain(res.status());
  if (res.status() === 200) {
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.reply).toBe("string");
    expect(json.reply.length).toBeGreaterThan(0);
  }
});
