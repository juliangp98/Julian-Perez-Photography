import { test, expect } from "@playwright/test";

// Mirrors `wedding-pdf.spec.ts` for the wedding-films route. Same three
// request-guard cases (missing-required → 400, honeypot → silent 200
// with no PDF leak, wrong-slug → 400). The happy-path PDF render is
// covered by manual verification — the questionnaire is large enough
// that fixturing every required field in a test would couple this
// spec tightly to the questionnaire schema.

test("wedding-films-plan: rejects missing required fields with 400", async ({
  request,
}) => {
  const res = await request.post("/api/wedding-films-plan", {
    data: {
      service: "wedding-films",
      answers: {
        // Empty — no fullName, etc.
      },
    },
  });
  expect(res.status()).toBe(400);
  const text = await res.text();
  expect(text.toLowerCase()).toContain("missing required field");
});

test("wedding-films-plan: honeypot triggered → 200 silently (no PDF leak)", async ({
  request,
}) => {
  const res = await request.post("/api/wedding-films-plan", {
    data: {
      service: "wedding-films",
      hp_company: "bot-filled",
      answers: {},
    },
  });
  expect(res.status()).toBe(200);
  // Honeypot path returns an empty body, not a PDF.
  const body = await res.body();
  expect(body.slice(0, 4).toString()).not.toBe("%PDF");
});

test("wedding-films-plan: rejects non-wedding-films service slug", async ({
  request,
}) => {
  const res = await request.post("/api/wedding-films-plan", {
    data: {
      service: "weddings",
      answers: {},
    },
  });
  expect(res.status()).toBe(400);
});
