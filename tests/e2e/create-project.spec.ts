import { test, expect, type APIRequestContext } from "@playwright/test";

// Manual project creation. Admin (/api/admin/create-project) is fully gated +
// testable; the portal route (/api/portal/create-project) needs a session that
// can't be minted against the blanked test store, so only its 401 is asserted.
// The store is blanked, so a well-formed admin create cleanly no-ops.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("admin create-project: rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/admin/create-project", {
    headers: { "x-forwarded-for": "10.99.24.1" },
    data: { email: "client@example.com" },
  });
  expect(res.status()).toBe(401);
});

test("admin create-project: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.24.2");
  // Missing the required `email` — a schema violation (400).
  const res = await request.post("/api/admin/create-project", {
    data: { clientName: "No Email Given" },
  });
  expect(res.status()).toBe(400);
});

test("admin create-project: accepts a well-formed create, no-ops on the blanked store", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.24.3");
  const res = await request.post("/api/admin/create-project", {
    data: {
      email: "newclient@example.com",
      clientName: "New Client",
      serviceType: "weddings",
    },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
});

test("portal create-project: rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/portal/create-project", {
    headers: { "x-forwarded-for": "10.99.24.4" },
    data: { serviceType: "weddings" },
  });
  expect(res.status()).toBe(401);
});
