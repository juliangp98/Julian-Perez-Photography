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
    expect(String(alert.body?.text)).toContain(`/admin/projects/${p.id}?tab=messages`);
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
      authentication: VERIFIED,
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
      authentication: VERIFIED,
    });
    expect(sentTo(await fakes.calls("resend"), p.email)).toHaveLength(1);
    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    const thread = adminPage.getByRole("list", { name: "Messages" });
    await expect(thread.getByText("The reply that started all this.")).toBeVisible();
    await expect(thread.getByText("Filed from Gmail")).toBeVisible();
    // Trusted, so the forwarded block is filed as the client's own message,
    // not held whole with its "Forwarded message" lines.
    const filed = thread.getByRole("listitem").filter({ hasText: "The reply that started all this." });
    await expect(filed).not.toContainText("Forwarded message");
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
    await expect(page.getByRole("status").filter({ hasText: "Sent. I'll see it in my email too." })).toBeVisible();
    await expect(thread.getByText("Can we start at four?")).toBeVisible();
  });

  test("mail from julian@ is the owner's: relayed when verified, held when not, filed from log+, and the site's own is dropped", async ({
    adminRequest,
    adminPage,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    const julian = "Julian Perez <julian@julianperezphotography.com>";
    await receive(adminRequest, fakes, p, { from: julian, text: "From the studio address.", authentication: VERIFIED });
    let toClient = sentTo(await fakes.calls("resend"), p.email);
    expect(toClient.at(-1)?.body?.text).toBe("From the studio address.");

    // The site's own mail looping back: the marker header, or the alerts sender.
    await receive(adminRequest, fakes, p, {
      from: julian,
      text: "A copy of a site email.",
      headers: { "X-JPP-Sent-By": "site" },
      authentication: VERIFIED,
    });
    await receive(adminRequest, fakes, p, {
      from: "Julian Perez Photography <noreply@julianperezphotography.com>",
      text: "An alert answered by a rule.",
      authentication: VERIFIED,
    });
    toClient = sentTo(await fakes.calls("resend"), p.email);
    expect(toClient.map((c) => c.body?.text)).not.toContain("A copy of a site email.");
    expect(toClient.map((c) => c.body?.text)).not.toContain("An alert answered by a rule.");
    expect(sentTo(await fakes.calls("resend"), OWNER)).toHaveLength(0);

    // Sent as julian@ through Gmail's own servers (signed by gmail.com, so
    // Resend's DKIM result is gray): held for a click.
    await receive(adminRequest, fakes, p, {
      from: julian,
      text: "Through Gmail.",
      authentication: { spf: "pass", dkim: "gray", dmarc: "fail" },
    });
    // A header the sender wrote claiming a pass is never believed.
    await receive(adminRequest, fakes, p, {
      from: julian,
      text: "A forged pass.",
      headers: { "Authentication-Results": "mx.resend.com; dkim=pass header.d=julianperezphotography.com" },
      authentication: { spf: "fail", dkim: "gray", dmarc: "fail" },
    });
    // And a look-alike signing domain doesn't reach the client either.
    await receive(adminRequest, fakes, p, {
      from: julian,
      text: "A look-alike domain.",
      headers: { "Authentication-Results": "mx; dkim=pass header.d=julianperezphotography.com.evil.test" },
    });
    // Julian's address in the display name, on mail its own domain signs: not his.
    await receive(adminRequest, fakes, p, {
      from: '"<julian@julianperezphotography.com>" <x@evil.test>',
      text: "A borrowed name.",
      authentication: VERIFIED,
    });
    // Julian's address, but a second one in the line: held for him, not sent.
    await receive(adminRequest, fakes, p, {
      from: '"x@evil.test" <julian@julianperezphotography.com>',
      text: "Two addresses in one line.",
      authentication: VERIFIED,
    });
    const sent = sentTo(await fakes.calls("resend"), p.email).map((c) => c.body?.text);
    for (const held of [
      "Through Gmail.",
      "A forged pass.",
      "A look-alike domain.",
      "A borrowed name.",
      "Two addresses in one line.",
    ]) {
      expect(sent).not.toContain(held);
    }
    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    const held = adminPage.getByRole("listitem").filter({ hasText: "Through Gmail." });
    await expect(held.getByRole("button", { name: /send it to the client/i })).toBeVisible();
    const twoAddresses = adminPage.getByRole("listitem").filter({ hasText: "Two addresses in one line." });
    await expect(twoAddresses.getByRole("button", { name: /send it to the client/i })).toBeVisible();

    // Forwarded from julian@ to the filing address: filed, nothing sent.
    const sends = sentTo(await fakes.calls("resend"), p.email).length;
    await receive(adminRequest, fakes, p, {
      from: julian,
      to: [p.replyAddress.replace("reply+", "log+")],
      text: "Filed from the studio address.",
      authentication: VERIFIED,
    });
    expect(sentTo(await fakes.calls("resend"), p.email)).toHaveLength(sends);
    await adminPage.reload();
    const filed = adminPage.getByRole("listitem").filter({ hasText: "Filed from the studio address." });
    await expect(filed).toContainText("Filed from Gmail");

    // A forward to the filing address that fails the check is held whole:
    // its blocks aren't read as anyone's messages.
    await receive(adminRequest, fakes, p, {
      from: julian,
      to: [p.replyAddress.replace("reply+", "log+")],
      text: [
        "---------- Forwarded message ---------",
        `From: Avery <${p.email}>`,
        "Date: Mon, Nov 17, 2026 at 3:04 PM",
        "Subject: Re: Our wedding",
        "",
        "An unproven forward.",
      ].join("\n"),
      authentication: { spf: "pass", dkim: "gray", dmarc: "fail" },
    });
    expect(sentTo(await fakes.calls("resend"), p.email)).toHaveLength(sends);
    await adminPage.reload();
    const whole = adminPage.getByRole("listitem").filter({ hasText: "An unproven forward." });
    await expect(whole).toHaveCount(1);
    await expect(whole).toContainText("Forwarded message");
  });

  test("a second photographer's reply is the owner's alone, named by its sender", async ({
    adminRequest,
    adminPage,
    portalRequest,
    page,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    const second = `e2e-second-${Date.now()}@example.com`;
    const added = await adminRequest.post("/api/admin/collaborators", {
      data: { action: "add", projectId: p.id, email: second, sendInvite: false },
    });
    expect(added.status()).toBe(200);
    await receive(adminRequest, fakes, p, { from: `Second Shooter <${second}>`, text: "Shot list looks good." });
    // Forwarded to the owner as a known sender, not held.
    const [forward] = sentTo(await fakes.calls("resend"), OWNER).slice(-1);
    expect(forward.body?.subject).not.toMatch(/^\[Held for review\]/);

    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    const row = adminPage.getByRole("listitem").filter({ hasText: "Shot list looks good." });
    await expect(row).toContainText("Second Shooter");
    await expect(row).toContainText("Not shown to the client");

    const client = await portalRequest(p.email);
    await page.context().addCookies(await client.storageState().then((s) => s.cookies));
    await page.goto(`/portal/projects/${p.id}`);
    await expect(page.getByRole("list", { name: "Messages" }).getByText("Opening note")).toBeVisible();
    await expect(page.getByText("Shot list looks good.")).toHaveCount(0);
  });

  test("every send carries the site's marker, and comes from Julian", async ({ adminRequest, fakes }) => {
    const p = await startThread(adminRequest, fakes);
    const [send] = sentTo(await fakes.calls("resend"), p.email);
    expect(send.body?.from).toBe("Julian Perez <julian@julianperezphotography.com>");
    expect((send.body?.headers as Record<string, string>)["X-JPP-Sent-By"]).toBe("site");
  });

  test("a send's Message-ID is recorded from its events, and the next send replies to it", async ({
    adminRequest,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    await post(adminRequest, { ...deliveryEvent("email.sent", p.resendId), data: { ...deliveryEvent("email.sent", p.resendId).data, message_id: "<first@resend.example>" } });
    // A later event can't replace it.
    await post(adminRequest, { ...deliveryEvent("email.delivered", p.resendId), data: { ...deliveryEvent("email.delivered", p.resendId).data, message_id: "<other@resend.example>" } });
    const again = await adminRequest.post("/api/admin/send-email", {
      data: { projectId: p.id, subject: "Second note", body: "One more thing." },
    });
    expect(again.status()).toBe(200);
    const [second] = sentTo(await fakes.calls("resend"), p.email).slice(-1);
    const headers = second.body?.headers as Record<string, string>;
    expect(headers["In-Reply-To"]).toBe("<first@resend.example>");
    expect(headers.References).toBe("<first@resend.example>");
  });

  test("mail filed from a vendor stays the owner's, named by its sender, and Julian's filed mail shows only when it was to the client", async ({
    adminRequest,
    adminPage,
    portalRequest,
    page,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    const forwarded = [
      "---------- Forwarded message ---------",
      "From: Riverside Venue <events@venue.test>",
      "Date: Mon, Nov 17, 2026 at 3:04 PM",
      "Subject: Load-in times",
      `To: <admin@example.com>`,
      "",
      "Vendors load in at noon.",
      "",
      "---------- Forwarded message ---------",
      "From: Julian <admin@example.com>",
      "Date: Mon, Nov 17, 2026 at 4:00 PM",
      "Subject: Re: Load-in times",
      "To: <events@venue.test>",
      "",
      "Noon works for me.",
      "",
      "---------- Forwarded message ---------",
      "From: Julian <admin@example.com>",
      "Date: Mon, Nov 17, 2026 at 5:00 PM",
      "Subject: Your timeline",
      `To: Avery <${p.email}>`,
      "",
      "Your timeline is set.",
    ].join("\n");
    await receive(adminRequest, fakes, p, {
      from: "admin@example.com",
      to: [p.replyAddress.replace("reply+", "log+")],
      text: forwarded,
      authentication: VERIFIED,
    });

    await adminPage.goto(`/admin/projects/${p.id}?tab=messages`);
    const admin = adminPage.getByRole("list", { name: "Messages" });
    const vendor = admin.getByRole("listitem").filter({ hasText: "Vendors load in at noon." });
    await expect(vendor).toContainText("Riverside Venue");
    await expect(vendor).toContainText("Not shown to the client");

    const client = await portalRequest(p.email);
    await page.context().addCookies(await client.storageState().then((s) => s.cookies));
    await page.goto(`/portal/projects/${p.id}`);
    const thread = page.getByRole("list", { name: "Messages" });
    await expect(thread.getByText("Your timeline is set.")).toBeVisible();
    await expect(thread.getByText("Vendors load in at noon.")).toHaveCount(0);
    await expect(thread.getByText("Noon works for me.")).toHaveCount(0);
  });

  test("an answer to a portal alert reaches the client under the thread's subject, and its link is a link", async ({
    adminRequest,
    portalRequest,
    page,
    fakes,
  }) => {
    const p = await startThread(adminRequest, fakes);
    const client = await portalRequest(p.email);
    await client.post("/api/portal/messages", { data: { projectId: p.id, body: "Where do we park?" } });
    await receive(adminRequest, fakes, p, {
      from: "admin@example.com",
      text: "The lot is behind the barn: https://maps.example.com/barn.",
      authentication: VERIFIED,
      subject: "Re: New message on E2E Thread",
    });
    const [relay] = sentTo(await fakes.calls("resend"), p.email).slice(-1);
    expect(relay.body?.subject).toBe("Re: Opening note");
    // The branded email links the address without the full stop.
    expect(String(relay.body?.html)).toContain('href="https://maps.example.com/barn"');

    await page.context().addCookies(await client.storageState().then((s) => s.cookies));
    await page.goto(`/portal/projects/${p.id}`);
    await expect(page.getByRole("link", { name: "https://maps.example.com/barn", exact: true })).toHaveAttribute(
      "href",
      "https://maps.example.com/barn",
    );
  });
});

// ── helpers ──

type Thread = { id: string; email: string; resendId: string; replyAddress: string };
type Incoming = {
  from: string;
  text: string;
  to?: string[];
  headers?: Record<string, string>;
  authentication?: { spf?: string; dkim?: string; dmarc?: string };
  subject?: string;
};
// Resend's verdict on mail really sent from its From domain.
const VERIFIED = { spf: "pass", dkim: "pass", dmarc: "pass" };

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
  m: Incoming,
) {
  const email = {
    id: `in-${Date.now()}-${++inboundSeq}`,
    from: m.from,
    to: m.to ?? [p.replyAddress],
    subject: m.subject ?? "Re: Opening note",
    text: m.text,
    html: null,
    headers: m.headers ?? {},
    // Resend's own check of the sender, made on arrival; null when it has none.
    authentication: m.authentication ?? null,
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
  m: Incoming,
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
