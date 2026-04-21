import { test, expect } from "@playwright/test";

// The wedding-plan route powers both the mid-form Preview button and the
// post-submit Download button. These tests exercise the request guards
// and the missing-field validation path — they don't try to render a
// complete PDF (that would require fixturing the full 10-section form).
//
// The happy-path PDF render is covered by manual verification: submit
// a real wedding questionnaire in dev and click "Preview my plan (PDF)".

test("wedding-plan: rejects missing required fields with 400", async ({
  request,
}) => {
  const res = await request.post("/api/wedding-plan", {
    data: {
      service: "weddings",
      answers: {
        // Deliberately empty — no fullName, email, etc.
      },
    },
  });
  expect(res.status()).toBe(400);
  const text = await res.text();
  expect(text.toLowerCase()).toContain("missing required field");
});

test("wedding-plan: honeypot triggered → 200 silently (no PDF leak)", async ({
  request,
}) => {
  const res = await request.post("/api/wedding-plan", {
    data: {
      service: "weddings",
      hp_company: "bot-filled",
      answers: {},
    },
  });
  expect(res.status()).toBe(200);
  // Honeypot path returns empty body — not a PDF.
  const body = await res.body();
  expect(body.slice(0, 4).toString()).not.toBe("%PDF");
});

test("wedding-plan: rejects non-wedding service slug", async ({ request }) => {
  const res = await request.post("/api/wedding-plan", {
    data: {
      service: "corporate-headshots",
      answers: {},
    },
  });
  expect(res.status()).toBe(400);
});
