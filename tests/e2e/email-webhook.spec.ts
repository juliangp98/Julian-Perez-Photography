import type { APIRequestContext } from "@playwright/test";
import { test, expect, hasTestStore, type FakeCall } from "./support/fixtures";
import { signedWebhook } from "./support/webhook-sign";

// The thread end to end: a send from the admin, Resend's delivery events, a
// client's reply arriving at the project's reply address, the forward to the
// owner, the owner answering from Gmail, and the portal side of the same
// thread. Provider calls go to the fakes; the store is the test project.

const OWNER = "owner@example.com"; // INQUIRY_TO in playwright.config.ts
const WEBHOOK = "/api/email/webhook";

const sentTo = (calls: FakeCall[], to: string) =>
  calls.filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(to));

test("webhook: an unsigned request is refused", async ({ request }) => {
  const res = await request.post(WEBHOOK, {
    data: { type: "email.delivered", data: { email_id: "x" } },
  });
  expect(res.status()).toBe(401);
});

test("webhook: a tampered body is refused", async ({ request }) => {
  const signed = signedWebhook({ type: "email.delivered", created_at: "", data: { email_id: "x" } });
  const res = await request.post(WEBHOOK, {
    headers: signed.headers,
    data: signed.data.replace('"x"', '"y"'),
  });
  expect(res.status()).toBe(401);
});

test("webhook: a signed event for an email that isn't on a thread is accepted and ignored", async ({
  request,
}) => {
  const res = await request.post(WEBHOOK, signedWebhook(deliveryEvent("email.delivered", "not-ours")));
  expect(res.status()).toBe(200);
});

test("webhook: mail to an address with no project token is ignored", async ({ request, fakes }) => {
  const res = await request.post(
    WEBHOOK,
    signedWebhook(receivedEvent({ id: "in-none", from: "x@example.com", to: ["hello@in.example.test"] })),
  );
  expect(res.status()).toBe(200);
  expect(sentTo(await fakes.calls("resend"), OWNER)).toHaveLength(0);
});

test.describe("the thread against the test store", () => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");

  test("a send shows on the thread and moves to Delivered", async ({ adminRequest, adminPage, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    await post(adminRequest, deliveryEvent("email.delivered", p.resendId));
    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    const thread = adminPage.getByRole("list", { name: "Messages" });
    await expect(thread.getByText("Opening note")).toBeVisible();
    await expect(thread.getByText("Delivered")).toBeVisible();
  });

  // The page re-renders from the server after the send (router.refresh); the
  // new message has to appear on the thread without a reload.
  test("a send from Compose shows on the thread without a reload", async ({ adminRequest, adminPage, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    await adminPage.getByRole("combobox", { name: "Email template" }).selectOption({ label: "Inquiry reply" });
    await adminPage.getByRole("textbox", { name: "Subject" }).fill("Second note");
    await adminPage.getByRole("textbox", { name: "Email body" }).fill("Following up from Compose.");
    await adminPage.getByRole("button", { name: "Send to client" }).click();
    await expect(adminPage.getByRole("status").filter({ hasText: "Sent to the client." })).toBeVisible();
    await expect(
      adminPage.getByRole("list", { name: "Messages" }).getByText("Following up from Compose."),
    ).toBeVisible();
    expect(sentTo(await fakes.calls("resend"), p.email).at(-1)?.body?.text).toBe("Following up from Compose.");
  });

  test("a bounce marks the message and tells the owner", async ({ adminRequest, adminPage, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    await post(adminRequest, {
      ...deliveryEvent("email.bounced", p.resendId),
      data: { ...deliveryEvent("email.bounced", p.resendId).data, bounce: { message: "Mailbox does not exist", type: "Permanent", subType: "General" } },
    });
    const [alert] = sentTo(await fakes.calls("resend"), OWNER).slice(-1);
    expect(alert.body?.subject).toMatch(/bounced/);
    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    await expect(adminPage.getByText("Mailbox does not exist")).toBeVisible();
  });

  test("a client reply lands on the thread and is forwarded with the reply address", async ({
    adminRequest,
    adminPage,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    await receive(adminRequest, fakes, p, { from: p.email, text: "Thursday works.\n\nOn Mon Julian wrote:\n> hi" });

    const [forward] = sentTo(await fakes.calls("resend"), OWNER).slice(-1);
    expect(forward.body?.reply_to).toBe(p.replyAddress);
    expect(String(forward.body?.text)).toContain("Thursday works.");
    expect(String(forward.body?.text)).not.toContain("> hi");
    // The alert opens the project's thread, on its Messages tab.
    expect(String(forward.body?.text)).toContain(`/admin/projects/${p.id}?tab=messages`);

    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    await expect(adminPage.getByRole("list", { name: "Messages" }).getByText("Thursday works.")).toBeVisible();
  });

  test("the same event twice files one message and forwards once", async ({ adminRequest, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    const email = await seedInbound(fakes, p, { from: p.email, text: "Only once." });
    await post(adminRequest, receivedEvent(email));
    await post(adminRequest, receivedEvent(email));
    const forwards = sentTo(await fakes.calls("resend"), OWNER).filter((c) =>
      String(c.body?.text).includes("Only once."),
    );
    expect(forwards).toHaveLength(1);
  });

  test("an unknown sender is held for review and never relayed", async ({ adminRequest, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    await receive(adminRequest, fakes, p, { from: "stranger@example.test", text: "Hello?" });
    const calls = await fakes.calls("resend");
    const [forward] = sentTo(calls, OWNER).slice(-1);
    expect(forward.body?.subject).toMatch(/^\[Held for review\]/);
    expect(sentTo(calls, p.email)).toHaveLength(1); // only the opening send
  });

  test("an automatic reply is filed but not forwarded", async ({ adminRequest, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    await receive(adminRequest, fakes, p, {
      from: p.email,
      text: "I'm out of the office.",
      headers: { "Auto-Submitted": "auto-replied" },
    });
    expect(sentTo(await fakes.calls("resend"), OWNER)).toHaveLength(0);
  });

  test("the owner's verified reply from Gmail is relayed to the client", async ({ adminRequest, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    await receive(adminRequest, fakes, p, {
      from: "admin@example.com",
      text: "See you then.\n\nOn Tue Avery wrote:\n> Thursday works.",
      headers: { "Authentication-Results": "mx; dkim=pass header.d=example.com" },
    });
    const [relay] = sentTo(await fakes.calls("resend"), p.email).slice(-1);
    expect(relay.body?.text).toBe("See you then.");
    expect(relay.body?.reply_to).toBe(p.replyAddress);
  });

  test("the owner's unverified reply is held until released", async ({ adminRequest, adminPage, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    await receive(adminRequest, fakes, p, { from: "admin@example.com", text: "Unverified hello." });
    expect(sentTo(await fakes.calls("resend"), p.email)).toHaveLength(1);

    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    const released = adminPage.waitForResponse((r) => r.url().endsWith("/api/admin/messages"));
    await adminPage.getByRole("button", { name: /send it to the client/i }).click();
    expect((await released).status()).toBe(200);
    await expect(adminPage.getByRole("status").filter({ hasText: "Sent to the client." })).toBeVisible();
    const [relay] = sentTo(await fakes.calls("resend"), p.email).slice(-1);
    expect(relay.body?.text).toBe("Unverified hello.");
    await expect(adminPage.getByText("Sent after review.")).toBeVisible();

    // The thread records it: the held copy is marked, and there's nothing left to release.
    await adminPage.reload();
    await expect(adminPage.getByText("Sent after review.")).toBeVisible();
    await expect(adminPage.getByRole("button", { name: /send it to the client/i })).toHaveCount(0);
  });

  test("an old Gmail thread forwarded to the filing address is imported, not sent", async ({
    adminRequest,
    adminPage,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    const forwarded = [
      "---------- Forwarded message ---------",
      `From: Avery <${p.email}>`,
      "Date: Mon, Nov 17, 2026 at 3:04 PM",
      "Subject: Re: Our wedding",
      "",
      "The reply that started all this.",
    ].join("\n");
    await receive(adminRequest, fakes, p, {
      from: "admin@example.com",
      to: [p.replyAddress.replace("reply+", "log+")],
      text: forwarded,
      headers: { "Authentication-Results": "mx; dkim=pass header.d=example.com" },
    });
    expect(sentTo(await fakes.calls("resend"), p.email)).toHaveLength(1);
    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    const thread = adminPage.getByRole("list", { name: "Messages" });
    await expect(thread.getByText("The reply that started all this.")).toBeVisible();
    await expect(thread.getByText("Filed from Gmail")).toBeVisible();
  });

  test("the client sees the thread in the portal and can write on it", async ({
    adminRequest,
    portalRequest,
    page,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    const client = await portalRequest(p.email);
    const res = await client.post("/api/portal/messages", {
      data: { projectId: p.id, body: "A question from the portal." },
    });
    expect(res.status()).toBe(200);
    const [forward] = sentTo(await fakes.calls("resend"), OWNER).slice(-1);
    expect(String(forward.body?.text)).toContain("A question from the portal.");

    await page.context().addCookies(await client.storageState().then((s) => s.cookies));
    await page.goto(`/portal/projects/${p.id}`);
    const thread = page.getByRole("list", { name: "Messages" });
    await expect(thread.getByText("Opening note")).toBeVisible();
    await expect(thread.getByText("A question from the portal.")).toBeVisible();

    // Writing from the page itself: confirmed, and on the thread without a reload.
    await page.getByPlaceholder("Write to Julian…").fill("Can we start at four?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Sent. Julian gets it by email too." })).toBeVisible();
    await expect(thread.getByText("Can we start at four?")).toBeVisible();
  });
});

// ── helpers ──

type Thread = { id: string; email: string; resendId: string; replyAddress: string };

async function startThread(
  request: APIRequestContext,
  fakes: { calls: (p?: "resend") => Promise<FakeCall[]> },
): Promise<Thread> {
  const email = `e2e-thread-${Date.now()}@example.com`;
  const created = await request.post("/api/admin/create-project", {
    data: { email, clientName: "E2E Thread", serviceType: "weddings", force: true },
  });
  const { id } = await created.json();
  const sent = await request.post("/api/admin/send-email", {
    data: { projectId: id, subject: "Opening note", body: "Looking forward to it." },
  });
  expect(sent.status()).toBe(200);
  const { id: resendId } = await sent.json();
  const [call] = sentTo(await fakes.calls("resend"), email);
  return { id, email, resendId, replyAddress: String(call.body?.reply_to) };
}

async function post(request: APIRequestContext, event: unknown) {
  const res = await request.post(WEBHOOK, signedWebhook(event));
  expect(res.status()).toBe(200);
}

let inboundSeq = 0;
async function seedInbound(
  fakes: { inbound: (e: Record<string, unknown>) => Promise<void> },
  p: Thread,
  m: { from: string; text: string; to?: string[]; headers?: Record<string, string> },
) {
  const email = {
    id: `in-${Date.now()}-${++inboundSeq}`,
    from: m.from,
    to: m.to ?? [p.replyAddress],
    subject: "Re: Opening note",
    text: m.text,
    html: null,
    headers: m.headers ?? {},
    message_id: `<reply-${inboundSeq}@mail.example.com>`,
    attachments: [],
    created_at: new Date().toISOString(),
  };
  await fakes.inbound(email);
  return email;
}

async function receive(
  request: APIRequestContext,
  fakes: { inbound: (e: Record<string, unknown>) => Promise<void> },
  p: Thread,
  m: { from: string; text: string; to?: string[]; headers?: Record<string, string> },
) {
  await post(request, receivedEvent(await seedInbound(fakes, p, m)));
}

function deliveryEvent(type: string, emailId: string) {
  return {
    type,
    created_at: new Date().toISOString(),
    data: { email_id: emailId, created_at: new Date().toISOString(), from: "", to: [], subject: "" },
  };
}

function receivedEvent(email: { id: string; from: string; to: string[]; subject?: string; message_id?: string }) {
  return {
    type: "email.received",
    created_at: new Date().toISOString(),
    data: {
      email_id: email.id,
      created_at: new Date().toISOString(),
      from: email.from,
      to: email.to,
      cc: [],
      bcc: [],
      message_id: email.message_id ?? "",
      subject: email.subject ?? "",
      attachments: [],
    },
  };
}
