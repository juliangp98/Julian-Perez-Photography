import { test, expect, hasTestStore } from "./support/fixtures";

// Admin projects overview: quick-log API (status/note from the board) and the
// search/filter params. The API cases use an id no project has ("p1"), so the
// helpers find no row and do nothing while the route still accepts the shape;
// that holds with or without the test store. The pages cover the server-side
// filter path and the not-found state, and, with the test store, a quick-log
// note saved from the board.

test("admin quick-log: rejects an unauthenticated request", async ({
  request,
}) => {
  const res = await request.post("/api/admin/quick-log", {
    headers: { "x-forwarded-for": "10.88.0.1" },
    data: { projectId: "x", note: "hi" },
  });
  expect(res.status()).toBe(401);
});

test("admin quick-log: rejects an empty update when authenticated", async ({ adminRequest: request }) => {
  // Neither a status change nor a note → schema refinement rejects it (400),
  // proving the session was accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/quick-log", {
    data: { projectId: "x" },
  });
  expect(res.status()).toBe(400);
});

test("admin quick-log: accepts a note when authenticated", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/quick-log", {
    data: {
      projectId: "p1",
      note: "Called, left a voicemail",
    },
  });
  // No project has this id → the helper does nothing, but the route accepts it.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin projects: filter params render without error", async ({ adminPage: page }) => {
  // Exercise the server-side filter code path — it must render, not 500.
  await page.goto("/admin/projects?q=test&status=booked&service=weddings");
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 }),
  ).toBeVisible();
});

test("admin project page: a missing project renders the not-found state, not a 500", async ({ adminPage: page }) => {
  // The detail page server-renders its full tree — including the collapsible
  // questionnaire callout path. An id that isn't a project's must show the
  // not-found copy rather than 500.
  await page.goto("/admin/projects/no-such-project");
  await expect(page.getByText(/couldn.t be found/i)).toBeVisible();
});

test("admin update: accepts a project name when authenticated", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/update", {
    data: {
      id: "p1",
      fields: {
        projectName: "The Smiths' Wedding",
      },
    },
  });
  // No project has this id → no-op, but the route accepts the field.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin update: accepts the typed service/package/date values when authenticated", async ({ adminRequest: request }) => {
  // The locked-down edit form emits a service slug, a package name, and an ISO
  // event date — confirm those round-trip through the schema.
  const res = await request.post("/api/admin/update", {
    data: {
      id: "p1",
      fields: {
        serviceType: "weddings",
        package: "Silver",
        eventDate: "2027-06-12",
        guestCount: 120,
      },
    },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin update: accepts the declined status and a locations array", async ({ adminRequest: request }) => {
  // The new terminal "declined" status (booked-elsewhere) and the admin-editable
  // locations array both round-trip through the update schema.
  const res = await request.post("/api/admin/update", {
    data: {
      id: "p1",
      fields: {
        status: "declined",
        locations: [
          {
            label: "The Manor",
            address: "123 Main St, Arlington, VA",
            notes: "",
          },
        ],
      },
    },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin quick-log: a note saved from the board says so", async ({ adminRequest, adminPage }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const email = `e2e-quick-${Date.now()}@example.com`;
  await adminRequest.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Quick", serviceType: "weddings", force: true },
  });
  await adminPage.goto(`/admin/projects?q=${encodeURIComponent(email)}`);
  await adminPage.getByRole("button", { name: "Quick update +" }).click();
  await adminPage.getByPlaceholder("Add a note…").fill("Called, left a voicemail");
  await adminPage.getByRole("button", { name: "Save", exact: true }).click();
  await expect(adminPage.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
});
