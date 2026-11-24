import { test, expect, hasTestStore, type FakeCall } from "./support/fixtures";

// Every email the site sends goes through sendEmail(); these follow real sends
// into the fake Resend and check what actually left: recipients, reply-to, a
// one-line subject, a plain-text part, retries on transient failures, and an
// honest answer when a send fails. The fake records the API payload, which
// uses Resend's snake_case keys (reply_to).

const OWNER = "owner@example.com"; // INQUIRY_TO in playwright.config.ts

const sentTo = (calls: FakeCall[], to: string) =>
  calls.filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(to));

const inquiry = (over: Record<string, string> = {}) => ({
  name: "Avery Example",
  email: "avery@example.com",
  service: "weddings",
  message: "We're getting married next fall.",
  ...over,
});

test("inquiry: emails the owner and the client, each with a text part", async ({
  request,
  fakes,
}) => {
  const res = await request.post("/api/inquire", {
    data: inquiry({ eventDate: "2027-08-15" }),
  });
  expect(res.status()).toBe(200);

  const calls = await fakes.calls("resend");
  const [owner] = sentTo(calls, OWNER);
  expect(owner.body?.reply_to).toBe("avery@example.com");
  expect(owner.body?.subject).toContain("Avery Example");
  expect(owner.body?.subject).toContain("Aug 15, 2027");
  expect(owner.body?.subject).not.toMatch(/[\r\n]/);
  expect(String(owner.body?.text)).toContain("We're getting married next fall.");

  const [client] = sentTo(calls, "avery@example.com");
  expect(client.body?.text).toBeTruthy();
  expect(client.body?.reply_to).toBeTruthy();
});

test("inquiry: a project id from a completion link is accepted", async ({ request }) => {
  const res = await request.post("/api/inquire", {
    data: inquiry({ project: "00000000-0000-0000-0000-000000000000" }),
  });
  expect(res.status()).toBe(200);
});

test("inquiry: a transient Resend failure is retried and the send goes through", async ({
  request,
  fakes,
}) => {
  await fakes.script({ emailFailures: 1 });
  const res = await request.post("/api/inquire", { data: inquiry() });
  expect(res.status()).toBe(200);
  // One 503, then the retry that landed.
  expect(sentTo(await fakes.calls("resend"), OWNER)).toHaveLength(2);
});

test("inquiry: when the owner email can't go out, the visitor is told", async ({
  request,
  fakes,
}) => {
  await fakes.script({ emailFailures: 10 });
  const res = await request.post("/api/inquire", { data: inquiry() });
  expect(res.status()).toBe(500);
  expect((await res.json()).error).toMatch(/email .* directly/i);
});

test("inquiry: a refused client confirmation doesn't fail the submission", async ({
  request,
  fakes,
}) => {
  const res = await request.post("/api/inquire", {
    data: inquiry({ email: "nobody@fail.test" }),
  });
  expect(res.status()).toBe(200);
  expect(sentTo(await fakes.calls("resend"), OWNER)).toHaveLength(1);
});

test("inquiry: texts the client a confirmation at a normalized number", async ({
  request,
  fakes,
}) => {
  const res = await request.post("/api/inquire", {
    data: inquiry({ phone: "(703) 555-1234" }),
  });
  expect(res.status()).toBe(200);
  const [sms] = await fakes.calls("twilio");
  expect(sms.body?.To).toBe("+17035551234");
  expect(String(sms.body?.Body).length).toBeLessThanOrEqual(320);
});

test("inquiry: a refused text doesn't fail the submission", async ({ request, fakes }) => {
  // The fake Twilio rejects numbers ending in 0000.
  const res = await request.post("/api/inquire", {
    data: inquiry({ phone: "(703) 555-0000" }),
  });
  expect(res.status()).toBe(200);
  expect(await fakes.calls("twilio")).toHaveLength(1);
});

test("send-email: an unknown project is a 404, not a silent success", async ({
  adminRequest,
}) => {
  const res = await adminRequest.post("/api/admin/send-email", {
    data: { projectId: "no-such-project", subject: "Hello", body: "Hi there." },
  });
  expect(res.status()).toBe(404);
});

test.describe("send-email against the test store", () => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");

  async function createProject(
    request: import("@playwright/test").APIRequestContext,
    email: string,
  ) {
    const res = await request.post("/api/admin/create-project", {
      data: { email, clientName: "E2E Client", serviceType: "weddings", force: true },
    });
    expect(res.status()).toBe(200);
    return (await res.json()).id as string;
  }

  test("sends to the record's email and returns Resend's id", async ({
    adminRequest,
    fakes,
  }) => {
    const email = `e2e-send-${Date.now()}@example.com`;
    const projectId = await createProject(adminRequest, email);
    const res = await adminRequest.post("/api/admin/send-email", {
      data: { projectId, subject: "Line one\r\nBcc: someone@evil.test", body: "Hello." },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(true);
    expect(json.id).toMatch(/^fake-email-/);

    const [sent] = sentTo(await fakes.calls("resend"), email);
    expect(sent.body?.subject).toBe("Line one Bcc: someone@evil.test");
    expect(sent.body?.text).toBe("Hello.");
  });

  test("the same idempotency key sends once", async ({ adminRequest }) => {
    const projectId = await createProject(adminRequest, `e2e-idem-${Date.now()}@example.com`);
    const data = {
      projectId,
      subject: "Once",
      body: "Only once.",
      idempotencyKey: crypto.randomUUID(),
    };
    const first = await (await adminRequest.post("/api/admin/send-email", { data })).json();
    const second = await (await adminRequest.post("/api/admin/send-email", { data })).json();
    expect(second.id).toBe(first.id);
  });

  test("a refused send is reported with Resend's reason", async ({ adminRequest }) => {
    const projectId = await createProject(adminRequest, `e2e-${Date.now()}@fail.test`);
    const res = await adminRequest.post("/api/admin/send-email", {
      data: { projectId, subject: "Hi", body: "Hello." },
    });
    expect(res.status()).toBe(502);
    expect((await res.json()).error).toMatch(/Not sent: Resend refused it/);
  });
});
