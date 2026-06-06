import { test, expect } from "@playwright/test";

// Guard-path coverage for /api/assist/draft — the public client-side writing
// assistant. Written key-agnostic like the concierge spec: the provider may or
// may not be configured in the runner, so the well-formed case asserts a clean
// accepted response (draft is null when unconfigured, a string when it ran)
// rather than a specific draft. The honeypot path short-circuits before the
// provider, so its draft:null is deterministic. Nothing is persisted, so these
// run against the blanked test store with no side effects.

test("assist-draft: rejects a malformed body with 400", async ({ request }) => {
  // Missing the required `kind` and `question`.
  const res = await request.post("/api/assist/draft", {
    headers: { "x-forwarded-for": "10.99.25.1" },
    data: { notes: "rough notes only" },
  });
  expect(res.status()).toBe(400);
});

test("assist-draft: rejects an unknown kind with 400", async ({ request }) => {
  const res = await request.post("/api/assist/draft", {
    headers: { "x-forwarded-for": "10.99.25.2" },
    data: { kind: "not-a-kind", question: "What's your vision?" },
  });
  expect(res.status()).toBe(400);
});

test("assist-draft: honeypot triggered → silent success, no draft", async ({
  request,
}) => {
  const res = await request.post("/api/assist/draft", {
    headers: { "x-forwarded-for": "10.99.25.3" },
    data: {
      kind: "inquiry",
      question: "Tell me about your vision",
      notes: "bot",
      hp_company: "bot-filled",
    },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  // Honeypot short-circuits before the provider, so this is always null.
  expect(json.draft ?? null).toBeNull();
});

test("assist-draft: a well-formed request with context is accepted", async ({
  request,
}) => {
  const res = await request.post("/api/assist/draft", {
    headers: { "x-forwarded-for": "10.99.25.4" },
    data: {
      kind: "questionnaire",
      question: "What's the vibe you're going for?",
      service: "weddings",
      notes: "relaxed, candid, golden hour",
      context: {
        clientName: "Sam",
        details: [
          { label: "Event date", value: "2027-09-04" },
          { label: "Venue", value: "The Manor" },
        ],
      },
    },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  // draft is null when the provider is unconfigured, a string when it ran —
  // either passes; what matters is the request was accepted and shaped.
  expect(json.draft === null || typeof json.draft === "string").toBeTruthy();
});

test("assist-draft: rejects oversized context (too many detail rows)", async ({
  request,
}) => {
  // The schema caps details at 20 rows; the client bounds it too, so a payload
  // over the cap is malformed — rejected, never silently truncated.
  const details = Array.from({ length: 30 }, (_, i) => ({
    label: `Field ${i}`,
    value: `Value ${i}`,
  }));
  const res = await request.post("/api/assist/draft", {
    headers: { "x-forwarded-for": "10.99.25.5" },
    data: {
      kind: "questionnaire",
      question: "Anything else?",
      context: { details },
    },
  });
  expect(res.status()).toBe(400);
});
