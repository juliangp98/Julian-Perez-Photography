import { test, expect } from "./support/fixtures";

// Owner-composed pipeline emails (/api/admin/send-email). The owner picks a
// stage template on a project, it prefills, they edit, then send. The recipient
// is resolved server-side from the project id (never trusted from the body).
//
// Guard coverage; real sends, retries and failures are in email-send.spec.ts.

test("send-email: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/send-email", {
    headers: { "x-forwarded-for": "10.99.8.1" },
    data: { projectId: "p1", subject: "Hello", body: "Hi there." },
  });
  expect(res.status()).toBe(401);
});

test("send-email: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing subject and body — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/send-email", {
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(400);
});
