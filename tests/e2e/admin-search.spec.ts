import { test, expect } from "./support/fixtures";

// Natural-language admin search (/api/admin/search). The owner types a plain
// query; the AI turns it into a structured filter applied to the client list,
// and the route returns matching projects. Admin-gated, rate-limited, read-only.
//
// With the store blanked in this environment there are no clients, so the route
// short-circuits to an empty result set WITHOUT calling the provider (and a
// keyless env no-ops earlier still) — either way a well-formed authed request is
// a deterministic 200 with no matches.

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

test("admin search: accepts a well-formed request, returns no matches on an empty store", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/search", {
    data: { query: "weddings in June with no contract yet" },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(Array.isArray(json.matches)).toBe(true);
  expect(json.matches.length).toBe(0);
});
