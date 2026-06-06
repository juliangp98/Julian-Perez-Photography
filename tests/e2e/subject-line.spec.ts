import { test, expect } from "@playwright/test";

// The subject-line enhancement formats an ISO date as "Aug 15, 2027"
// and appends it to the email subject. Resend's sent email isn't
// inspectable from tests (no API key in test mode), but the API can
// be asserted to round-trip successfully with a date and to exercise
// formatSubjectDate in the inquire path.
//
// Direct unit coverage of formatSubjectDate would be nicer; this
// smoke test just ensures the handler doesn't throw when a date is
// supplied.

test("inquire: accepts a payload with eventDate", async ({ request }) => {
  const res = await request.post("/api/inquire", {
    headers: { "x-forwarded-for": "10.99.2.1" },
    data: {
      name: "Date Test",
      email: "date@example.com",
      service: "weddings",
      eventDate: "2027-08-15",
      message: "Testing date formatting",
    },
  });
  expect([200, 429]).toContain(res.status());
  if (res.status() === 200) {
    const json = await res.json();
    expect(json.ok).toBe(true);
  }
});

test("inquire: accepts a payload without eventDate", async ({ request }) => {
  const res = await request.post("/api/inquire", {
    headers: { "x-forwarded-for": "10.99.2.1" },
    data: {
      name: "No Date Test",
      email: "nodate@example.com",
      service: "weddings",
      message: "Testing missing date",
    },
  });
  expect([200, 429]).toContain(res.status());
});

test("inquire: accepts a payload carrying a project id (completion link)", async ({
  request,
}) => {
  // A project completion link threads `?project=<id>` into the inquiry so the
  // submission attaches to that exact project. The route must accept the field
  // (the attach itself no-ops on the blanked test store).
  const res = await request.post("/api/inquire", {
    headers: { "x-forwarded-for": "10.99.24.5" },
    data: {
      name: "Attach Test",
      email: "attach@example.com",
      service: "weddings",
      message: "From a project completion link.",
      project: "00000000-0000-0000-0000-000000000000",
    },
  });
  expect([200, 429]).toContain(res.status());
  if (res.status() === 200) {
    const json = await res.json();
    expect(json.ok).toBe(true);
  }
});

test("inquire: accepts a wedding-films service slug", async ({ request }) => {
  // The wedding-films slug was added in the wedding-video → wedding-films
  // rename. The handler resolves the service title via getService() and
  // falls back to the raw slug when the catalog lookup misses. This test
  // guards both the dropdown's slug (wedding-films) and the API's
  // willingness to round-trip it.
  const res = await request.post("/api/inquire", {
    headers: { "x-forwarded-for": "10.99.4.1" },
    data: {
      name: "Wedding Films Test",
      email: "films@example.com",
      service: "wedding-films",
      message: "Interested in the Story Film hybrid tier.",
    },
  });
  expect([200, 429]).toContain(res.status());
  if (res.status() === 200) {
    const json = await res.json();
    expect(json.ok).toBe(true);
  }
});
