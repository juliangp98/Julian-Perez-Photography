import { test, expect, hasTestStore } from "./support/fixtures";

// Natural-language admin search (/api/admin/search). The owner types a plain
// query; the AI turns it into a structured filter applied to the client list,
// and the route returns matching projects. Admin-gated, rate-limited, read-only.
//
// The fake provider is scripted with the filter the model would return, so the
// result doesn't depend on what else is in the store. Without a store there are
// no projects and the route answers before calling the provider.

test("admin search: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/search", {
    headers: { "x-forwarded-for": "10.99.17.1" },
    data: { query: "weddings in June with no contract yet" },
  });
  expect(res.status()).toBe(401);
});

test("admin search: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing `query` — a schema violation (400), proving the session was accepted.
  const res = await request.post("/api/admin/search", {
    data: {},
  });
  expect(res.status()).toBe(400);
});

test("admin search: a filter that matches nothing returns no matches", async ({ adminRequest: request, fakes }) => {
  await fakes.script({ replies: [JSON.stringify({ text: "nobody-by-this-name", summary: "No one" })] });
  const res = await request.post("/api/admin/search", {
    data: { query: "weddings in June with no contract yet" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.matches).toEqual([]);
});

test("admin search: finds the project the filter describes", async ({ adminRequest: request, fakes }) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const email = `e2e-search-${Date.now()}@example.com`;
  const created = await request.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Search", serviceType: "weddings", force: true },
  });
  const { id } = await created.json();
  await fakes.script({ replies: [JSON.stringify({ text: email, summary: "Projects for that address" })] });
  const res = await request.post("/api/admin/search", { data: { query: `the project for ${email}` } });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.summary).toBe("Projects for that address");
  expect(json.matches.map((m: { id: string }) => m.id)).toEqual([id]);
});
