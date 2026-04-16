import { test, expect } from "@playwright/test";

// The subject-line enhancement formats an ISO date as "Aug 15, 2027"
// and appends it to the email subject. We can't inspect Resend's sent
// email (no API key in test mode), but we can at least assert the API
// round-trips successfully with a date and that formatSubjectDate's
// output is exercised in the inquire path.
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
