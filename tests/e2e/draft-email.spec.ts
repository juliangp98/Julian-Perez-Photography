import { test, expect, hasTestStore } from "./support/fixtures";

// AI email drafting (/api/admin/draft-email). The owner picks a pipeline
// template on a project and the route returns a personalized draft built from
// the project's server-side facts — which the owner reviews before sending (the
// route never sends). It is admin-gated and rate-limited.
//
// No project has the id "p1", so a well-formed authenticated request is
// accepted but no-ops (`drafted: false`) rather than calling a provider — the
// compose UI falls back to the static template. The auth guard, the schema, and
// the template-existence check are all reachable. With the test store, a real
// project is drafted through the stand-in AI provider, which shows what the
// model is and isn't sent.

test("draft-email: rejects an unauthenticated request", async ({ request }) => {
  const res = await request.post("/api/admin/draft-email", {
    headers: { "x-forwarded-for": "10.99.9.1" },
    data: { projectId: "p1", templateId: "gallery-delivery" },
  });
  expect(res.status()).toBe(401);
});

test("draft-email: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  // Missing templateId — a schema violation (400), proving the session was
  // accepted (otherwise this would be 401).
  const res = await request.post("/api/admin/draft-email", {
    data: { projectId: "p1" },
  });
  expect(res.status()).toBe(400);
});

test("draft-email: rejects an unknown template when authenticated", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/draft-email", {
    data: { projectId: "p1", templateId: "not-a-real-template" },
  });
  expect(res.status()).toBe(400);
});

test("draft-email: accepts a well-formed request, no-ops without an AI key", async ({ adminRequest: request }) => {
  const res = await request.post("/api/admin/draft-email", {
    data: {
      projectId: "p1",
      templateId: "gallery-delivery",
      instructions: "warmer tone",
    },
  });
  // No record resolves → the route accepts the request and reports it as not drafted
  // rather than erroring.
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.drafted).toBe(false);
});


test("draft-email: the model never gets the client's email or phone, and the draft keeps the prefilled link", async ({
  adminRequest: request,
  fakes,
  baseURL,
}) => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");
  const email = `e2e-draft-${Date.now()}@example.com`;
  const created = await request.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Draft", phone: "(703) 555-0142", serviceType: "weddings", force: true },
  });
  const { id } = await created.json();

  // The model answers with the questionnaire link exactly as it was given it.
  const bare = `${baseURL}/questionnaire/weddings?project=${id}`;
  await fakes.script({ replies: [`Subject: Planning your wedding\n\nHi,\n\nThe questionnaire is here: ${bare}\n\nJulian`] });
  const res = await request.post("/api/admin/draft-email", {
    data: { projectId: id, templateId: "planning-kickoff" },
  });
  expect(res.status()).toBe(200);
  const draft = await res.json();
  expect(draft.drafted).toBe(true);

  // What went to the provider: the form's address, none of the contact details.
  const sent = JSON.stringify((await fakes.calls("ai")).map((c) => c.body));
  expect(sent).toContain(bare);
  expect(sent).not.toContain(email);
  expect(sent).not.toContain(encodeURIComponent(email));
  expect(sent).not.toContain("555-0142");
  expect(sent).not.toContain("5550142");

  // What comes back to Compose: the link a client can open already filled in.
  expect(draft.body).toContain(`${bare}&fullName=E2E+Draft&email=${encodeURIComponent(email)}`);
});
