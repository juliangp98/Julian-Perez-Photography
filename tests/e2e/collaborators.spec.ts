import { test, expect, hasTestStore } from "./support/fixtures";

// Per-project second-photographer access. The admin grants/revokes a
// collaborator email via /api/admin/collaborators; the portal magic-link gate
// then also issues links to collaborator emails. This covers the admin route's
// auth and validation (on an id no project has, so the grant changes nothing)
// and the uniform portal request-link response; with the test store it also
// grants access on a real project from the admin page. Cross-account read
// access and the owner-only write guarantee are verified manually against
// real data.

test("admin collaborators: rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/admin/collaborators", {
    headers: { "x-forwarded-for": "10.71.0.1" },
    data: { action: "add", projectId: "p1", email: "second@example.com" },
  });
  expect(res.status()).toBe(401);
});

test("admin collaborators: rejects an invalid email when authenticated", async ({ adminRequest: request }) => {
  // A malformed email is a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/collaborators", {
    data: { action: "add", projectId: "p1", email: "not-an-email" },
  });
  expect(res.status()).toBe(400);
});

test("admin collaborators: accepts an add when authenticated", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/collaborators", {
    data: {
      action: "add",
      projectId: "p1",
      email: "second@example.com",
      name: "Second Shooter",
      sendInvite: false,
    },
  });
  // No project has this id → the helper does nothing, but the route accepts it.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin collaborators: accepts a remove when authenticated", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/collaborators", {
    data: { action: "remove", projectId: "p1", email: "second@example.com" },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("portal request-link: stays uniform for a collaborator email", async ({
  request,
}) => {
  // The gate also considers collaborator access. This address isn't on any
  // project, and the anti-enumeration response must stay a uniform 200.
  const res = await request.post("/api/portal/request-link", {
    headers: { "x-forwarded-for": "10.71.0.5" },
    data: { email: "second@example.com", hp_company: "" },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin collaborators: granting access on a project confirms and lists them", async ({
  adminRequest,
  adminPage,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const stamp = Date.now();
  const created = await adminRequest.post("/api/admin/create-project", {
    data: { email: `e2e-collab-${stamp}@example.com`, clientName: "E2E Collab", serviceType: "weddings", force: true },
  });
  const { id } = await created.json();
  const second = `e2e-second-${stamp}@example.com`;

  await adminPage.goto(`/admin/projects/${id}?tab=details`);
  await adminPage.getByLabel("Add a second photographer").fill(second);
  await adminPage.getByLabel("Email them a one-click sign-in link").uncheck();
  await adminPage.getByRole("button", { name: "Grant access" }).click();
  await expect(adminPage.getByRole("status").filter({ hasText: "Added." })).toBeVisible();
  // The list comes from the server: it shows the new address without a reload.
  await expect(adminPage.getByRole("listitem").filter({ hasText: second })).toBeVisible();
});

test("admin collaborators: the invite is in Julian's voice and says where to get a fresh link", async ({
  adminRequest,
  fakes,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const stamp = Date.now();
  const created = await adminRequest.post("/api/admin/create-project", {
    data: { email: `e2e-invite-${stamp}@example.com`, clientName: "E2E Invite", serviceType: "newborn", force: true },
  });
  const { id } = await created.json();
  const second = `e2e-invited-${stamp}@example.com`;
  const res = await adminRequest.post("/api/admin/collaborators", {
    data: { action: "add", projectId: id, email: second, sendInvite: true },
  });
  expect(res.status()).toBe(200);
  const invite = (await fakes.calls("resend")).find((c) => c.path === "/emails" && [c.body?.to].flat().includes(second));
  const text = String(invite?.body?.text);
  expect(text).toContain("I've shared the project");
  expect(text).toContain("the client's planning notes");
  expect(text).not.toContain("couple");
  expect(text).toMatch(/This sign-in link expires in 20 minutes\. For a fresh one, sign in at https?:\/\/[^\s]+\/portal\./);
  expect(String(invite?.body?.html)).toContain("expires in 20 minutes");
});
