import { test, expect } from "./support/fixtures";

// Admin projects overview: the board's search/filter params, the project
// page's not-found state, and the shapes /api/admin/update accepts. The API
// cases use an id no project has ("p1"), so the helpers find no row and do
// nothing while the route still checks the shape; that holds with or without
// the test store. The project page itself is in project-page.spec.ts.

test("admin update: a note needs a session", async ({ request }) => {
  const res = await request.post("/api/admin/update", {
    headers: { "x-forwarded-for": "10.88.0.1" },
    data: { id: "x", note: "hi" },
  });
  expect(res.status()).toBe(401);
});

test("admin update: a note needs some text, and a project", async ({ adminRequest }) => {
  // A blank note is refused (400), proving the session was accepted.
  expect((await adminRequest.post("/api/admin/update", { data: { id: "p1", note: "   " } })).status()).toBe(400);
  // No project has this id.
  expect(
    (await adminRequest.post("/api/admin/update", { data: { id: "p1", note: "Called, left a voicemail" } })).status(),
  ).toBe(404);
});

test("admin update: an email noted as sent needs a template it knows, and a project", async ({ adminRequest }) => {
  expect((await adminRequest.post("/api/admin/update", { data: { id: "p1", sent: "made-up" } })).status()).toBe(400);
  expect((await adminRequest.post("/api/admin/update", { data: { id: "p1", sent: "referral-ask" } })).status()).toBe(404);
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

test("admin update: refuses a status it doesn't know", async ({ adminRequest }) => {
  const res = await adminRequest.post("/api/admin/update", { data: { id: "p1", fields: { status: "made-up" } } });
  expect(res.status()).toBe(400);
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
