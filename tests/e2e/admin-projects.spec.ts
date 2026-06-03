import { test, expect, type APIRequestContext } from "@playwright/test";

// Admin projects overview: quick-log API (status/note from the board) and the
// search/filter params. With the store blanked in this environment the helpers
// no-op and the list is empty, so the quick-log UI and filter form (both gated
// on real records) aren't reachable — but the API guards and the server-side
// filter code path are.

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("admin quick-log: rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/admin/quick-log", {
    headers: { "x-forwarded-for": "10.88.0.1" },
    data: { projectId: "x", note: "hi" },
  });
  expect(res.status()).toBe(401);
});

test("admin quick-log: rejects an empty update when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.88.0.2");
  // Neither a status change nor a note → schema refinement rejects it (400),
  // proving the session was accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/quick-log", {
    data: { projectId: "x" },
  });
  expect(res.status()).toBe(400);
});

test("admin quick-log: accepts a note when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.88.0.3");
  const res = await request.post("/api/admin/quick-log", {
    data: { projectId: "p1", note: "Called, left a voicemail" },
  });
  // Store blanked → helper no-ops, but the route accepts it.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin projects: filter params render without error", async ({
  page,
  request,
}) => {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": "10.88.0.4" },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const { devLink } = await res.json();
  await page.goto(devLink);
  // Exercise the server-side filter code path — it must render, not 500.
  await page.goto("/admin/projects?q=test&status=booked&service=weddings");
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();
});

test("admin update: accepts a gallery URL when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.88.0.5");
  const res = await request.post("/api/admin/update", {
    data: {
      id: "p1",
      fields: { galleryUrl: "https://gallery.pic-time.com/abc" },
    },
  });
  // Store blanked → no-op, but the route accepts the gallery field.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});
