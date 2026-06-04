import { test, expect, type APIRequestContext } from "@playwright/test";

// AI journal post drafting (/api/admin/draft-journal). The owner gives a topic
// and gets a draft (title, excerpt, body, tags) to refine and publish in Studio
// — the AI never publishes. Admin-gated and rate-limited.
//
// Unlike the other AI routes, this one isn't store-gated (it's topic-driven), so
// a well-formed authed request reaches the provider whenever a key is configured.
// The deterministic, env-independent guarantee is therefore that it passes the
// auth + schema guards — it must never be a 401/400 client rejection. The outcome
// after that depends on the environment: 200 (no key → `drafted: false`, or a
// reachable provider → `drafted: true`) or 502 (key set but provider unreachable).

async function signInAsAdmin(request: APIRequestContext, ip: string) {
  const res = await request.post("/api/admin/request-link", {
    headers: { "x-forwarded-for": ip },
    data: { email: "admin@example.com", hp_company: "" },
  });
  const json = await res.json();
  expect(json.devLink).toBeTruthy();
  await request.get(json.devLink);
}

test("draft-journal: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-journal", {
    headers: { "x-forwarded-for": "10.99.14.1" },
    data: { topic: "Why I shoot documentary-style weddings" },
  });
  expect(res.status()).toBe(401);
});

test("draft-journal: rejects a malformed body when authenticated", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.14.2");
  // Missing topic — a schema violation (400), proving the session was accepted.
  const res = await request.post("/api/admin/draft-journal", {
    data: { postType: "Educational / tips" },
  });
  expect(res.status()).toBe(400);
});

test("draft-journal: a well-formed authed request passes the auth + schema guards", async ({
  request,
}) => {
  await signInAsAdmin(request, "10.99.14.3");
  const res = await request.post("/api/admin/draft-journal", {
    data: {
      topic: "5 tips for a relaxed engagement session in the DMV",
      postType: "Educational / tips",
    },
  });
  // Accepted past the guards — never a client rejection.
  expect(res.status()).not.toBe(401);
  expect(res.status()).not.toBe(400);
  // Then either a no-op / draft (200) or a provider error (502) by environment.
  expect([200, 502]).toContain(res.status());
  if (res.status() === 200) {
    expect((await res.json()).ok).toBe(true);
  }
});
