import { test, expect, type APIRequestContext } from "@playwright/test";

// Owner-composed pipeline emails (/api/admin/send-email). The owner picks a
// stage template on a project, it prefills, they edit, then send. The recipient
// is resolved server-side from the project id (never trusted from the body).
//
// Admin sign-in needs only ADMIN_EMAIL, so the endpoint is testable end-to-end:
// with the store blanked in this environment getClientFull returns nothing, so a
// well-formed authenticated request is accepted but no-ops (sent: false) rather
// than reaching out to a real client.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("send-email: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/send-email", {
    headers: { "x-forwarded-for": "10.99.8.1" },
    data: { projectId: "p1", subject: "Hello", body: "Hi there." },
  });
  expect(res.status()).toBe(401);
});

test("send-email: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.8.2");
  // Missing subject and body — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/send-email", {
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(400);
});

test("send-email: accepts a well-formed request, no-ops without a recipient", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.8.3");
  const res = await request.post("/api/admin/send-email", {
    data: {
      projectId: "p1",
      subject: "Your gallery is ready!",
      body: "Hi — your photos are ready to view.",
    },
  });
  // Store is blanked here, so no recipient resolves — the route accepts the
  // request and reports it as not sent rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.sent).toBe(false);
});
