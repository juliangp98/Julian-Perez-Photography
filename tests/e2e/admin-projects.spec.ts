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
    data: {
      projectId: "p1",
      note: "Called, left a voicemail",
      notifyClient: true,
    },
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

test("admin project page: a missing project renders the not-found state, not a 500", async ({
  page,
  request,
}) => {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": "10.88.0.7" },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const { devLink } = await res.json();
  await page.goto(devLink);
  // The detail page server-renders its full tree — including the collapsible
  // questionnaire callout path. With the store blanked the record is absent, so
  // it must show the not-found copy rather than 500.
  await page.goto("/admin/projects/no-such-project");
  await expect(page.getByText(/couldn.t be found/i)).toBeVisible();
});

test("admin update: accepts a gallery URL and project name when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.88.0.5");
  const res = await request.post("/api/admin/update", {
    data: {
      id: "p1",
      notifyClient: true,
      fields: {
        galleryUrl: "https://gallery.pic-time.com/abc",
        projectName: "The Smiths' Wedding",
      },
    },
  });
  // Store blanked → no-op, but the route accepts the new fields.
  expect(res.status()).toBe(200);
  expect((await res.json()).ok).toBe(true);
});

test("admin update: accepts the typed service/package/date values when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.88.0.6");
  // The locked-down edit form now emits a service slug, a package name, and an
  // ISO event date — confirm those round-trip through the schema. notifyClient
  // is on, exercising the change-summary path (no-op here without a record).
  const res = await request.post("/api/admin/update", {
    data: {
      id: "p1",
      notifyClient: true,
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

test("admin update: accepts the declined status and a locations array", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.88.0.8");
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
