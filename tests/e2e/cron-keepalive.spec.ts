import type { APIRequestContext } from "@playwright/test";
import { test, expect, hasTestStore, type FakeCall } from "./support/fixtures";
import { clearSetting, newProject, patchProject, putSetting, readSetting } from "./support/test-store";
import { formatHumanDate, shiftDay, studioToday } from "../../src/lib/field-format";
import { SITE_URL } from "../../src/lib/site-settings-data";

// The daily cron (/api/cron/keepalive): one query against the client store so
// the Supabase free tier never pauses, a delivery check for thread messages,
// the morning email (the board's Today rows, once a studio day), and a fresh
// pick of AI models from the provider's catalogue. Guarded by CRON_SECRET,
// which Vercel sends as a bearer. The model checks run against the fake
// catalogue and need the test store, where the choice is kept, as does the
// morning email, whose day is claimed there.

const SECRET = "e2e-cron-secret";
const OWNER = "owner@example.com"; // INQUIRY_TO in playwright.config.ts

const runCron = async (request: APIRequestContext) => {
  const res = await request.get("/api/cron/keepalive", {
    headers: { authorization: `Bearer ${SECRET}` },
  });
  expect(res.status()).toBe(200);
  return res.json();
};

const ownerNotices = (calls: FakeCall[], subject: RegExp) =>
  calls.filter(
    (c) => c.path === "/emails" && [c.body?.to].flat().includes(OWNER) && subject.test(String(c.body?.subject)),
  );

test("keepalive: rejects a request without the cron secret", async ({ request }) => {
  const res = await request.get("/api/cron/keepalive");
  expect(res.status()).toBe(401);
});

test("keepalive: rejects a request with the wrong cron secret", async ({ request }) => {
  const res = await request.get("/api/cron/keepalive", {
    headers: { authorization: "Bearer not-the-secret" },
  });
  expect(res.status()).toBe(401);
});

test("keepalive: without a store there's nothing to keep alive", async ({ request }) => {
  test.skip(hasTestStore, "the test store is configured");
  const json = await runCron(request);
  expect(json).toMatchObject({ ok: true, skipped: "store-unconfigured" });
});

// A request that reaches the AI provider: a journal post draft. Its reply is
// queued after the cron runs, since the cron's own test calls take queued
// replies (only a call that succeeds uses one).
const JOURNAL_DRAFT = JSON.stringify({ title: "A test post", excerpt: "A teaser.", body: "One.\n\nTwo.", tags: ["test"] });
const draftPost = (adminRequest: APIRequestContext) =>
  adminRequest.post("/api/admin/draft-copy", { data: { kind: "journal", topic: "A test topic" } });

test.describe("the daily run against the test store", () => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");

  test("pings the store and picks the preferred served model", async ({ request }) => {
    const json = await runCron(request);
    expect(json.ok).toBe(true);
    expect(typeof json.count).toBe("number");
    expect(typeof json.settled).toBe("number");
    expect(["sent", "nothing-to-do", "already-sent"]).toContain(json.morning);
    expect(json.models).toBe("openai/gpt-oss-120b");
  });

  test("when the main model's family is retired, another family takes over and the owner hears once", async ({
    request,
    fakes,
  }) => {
    await runCron(request); // start from the default catalogue's choice
    await fakes.script({
      models: [
        { id: "qwen/qwen3-32b", context_window: 131072, active: true },
        { id: "llama-3.1-8b-instant", context_window: 131072, active: true },
        { id: "qwen/qwen3.6-27b", context_window: 131072, active: true },
      ],
    });
    expect((await runCron(request)).models).toBe("qwen/qwen3-32b");
    await runCron(request);

    const notices = ownerNotices(await fakes.calls("resend"), /^AI models: now qwen\/qwen3-32b$/);
    expect(notices).toHaveLength(1);
    expect(String(notices[0].body?.text)).toContain("Fallback: llama-3.1-8b-instant");
  });

  test("a request whose model was just retired is answered by the fallback", async ({
    adminRequest,
    request,
    fakes,
  }) => {
    await runCron(request); // main openai/gpt-oss-120b, fallback qwen/qwen3-32b
    const probes = (await fakes.calls("ai")).length; // the cron's test calls
    await fakes.script({ retired: ["openai/gpt-oss-120b"], replies: [JOURNAL_DRAFT] });
    const res = await draftPost(adminRequest);
    expect(res.status()).toBe(200);
    expect((await res.json()).post?.title).toBe("A test post");

    const tried = (await fakes.calls("ai"))
      .slice(probes)
      .filter((c) => c.path === "/chat/completions")
      .map((c) => c.body?.model);
    expect(tried).toEqual(["openai/gpt-oss-120b", "qwen/qwen3-32b"]);
  });

  test("a request the main model keeps rate-limiting is answered by the fallback, models unchanged", async ({
    adminRequest,
    request,
    fakes,
  }) => {
    await runCron(request); // main openai/gpt-oss-120b, fallback qwen/qwen3-32b
    const probes = (await fakes.calls("ai")).length;
    await fakes.script({ rateLimited: ["openai/gpt-oss-120b"], replies: [JOURNAL_DRAFT] });
    const res = await draftPost(adminRequest);
    expect(res.status()).toBe(200);
    expect((await res.json()).post?.title).toBe("A test post");

    // Three tries on the main model (the call and two retries), then the fallback.
    const tried = (await fakes.calls("ai"))
      .slice(probes)
      .filter((c) => c.path === "/chat/completions")
      .map((c) => c.body?.model);
    expect(tried).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-120b", "openai/gpt-oss-120b", "qwen/qwen3-32b"]);
    // A busy model is no reason to re-choose: the catalogue wasn't asked again.
    expect((await fakes.calls("ai")).slice(probes).filter((c) => c.path === "/models")).toEqual([]);
  });

  test("an answer the main model runs out of room for is answered by the fallback", async ({
    adminRequest,
    request,
    fakes,
  }) => {
    await runCron(request); // main openai/gpt-oss-120b, fallback qwen/qwen3-32b
    const probes = (await fakes.calls("ai")).length;
    await fakes.script({ cutOff: ["openai/gpt-oss-120b"], replies: [JOURNAL_DRAFT] });
    const res = await draftPost(adminRequest);
    expect(res.status()).toBe(200);
    expect((await res.json()).post?.title).toBe("A test post");

    // Tried once (not retried), then the fallback. A draft that didn't ask
    // for room to reason keeps its own limit on both.
    const tried = (await fakes.calls("ai")).slice(probes).filter((c) => c.path === "/chat/completions");
    expect(tried.map((c) => [c.body?.model, c.body?.max_tokens])).toEqual([
      ["openai/gpt-oss-120b", 2000],
      ["qwen/qwen3-32b", 2000],
    ]);
    // Having no room isn't a reason to re-choose: the catalogue wasn't asked again.
    expect((await fakes.calls("ai")).slice(probes).filter((c) => c.path === "/models")).toEqual([]);
  });

  test("a request too large for the main model's per-minute limit goes to the fallback", async ({
    adminRequest,
    request,
    fakes,
  }) => {
    await runCron(request);
    const probes = (await fakes.calls("ai")).length;
    await fakes.script({ tooLarge: ["openai/gpt-oss-120b"], replies: [JOURNAL_DRAFT] });
    const res = await draftPost(adminRequest);
    expect(res.status()).toBe(200);
    expect((await res.json()).post?.title).toBe("A test post");
    const tried = (await fakes.calls("ai"))
      .slice(probes)
      .filter((c) => c.path === "/chat/completions")
      .map((c) => c.body?.model);
    expect(tried).toEqual(["openai/gpt-oss-120b", "qwen/qwen3-32b"]);
  });

  test("when every model is rate-limited the request says so rather than re-choosing", async ({
    adminRequest,
    request,
    fakes,
  }) => {
    await runCron(request);
    await fakes.script({ rateLimited: ["openai/gpt-oss-120b", "qwen/qwen3-32b"] });
    const res = await draftPost(adminRequest);
    expect(res.status()).toBe(502);
  });
});

// The morning email: the Today list's rows, to the owner, once a studio day.
// The shared store holds other specs' projects too, so each test checks its
// own projects' rows, and the email's own consistency, rather than totals.
test.describe("the morning email", () => {
  test.skip(!hasTestStore, "needs the test Supabase project in .env.test");

  const claim = () => `morning-email:${studioToday()}`;
  const mornings = (calls: FakeCall[]) => ownerNotices(calls, /^Today, [A-Z][a-z]+ \d+: (1 thing needs|\d+ things need) you$/);
  const parts = (call: FakeCall) => call.body as { subject: string; text: string; html: string };

  test.beforeEach(async () => {
    await clearSetting(claim());
  });

  test("emails the owner the Today rows once, on the site's address", async ({ adminRequest, request, fakes }) => {
    const today = studioToday();
    const stamp = Date.now();
    const due = await newProject(adminRequest, `Morning due-${stamp}`);
    await patchProject(due.id, { follow_up_at: today, follow_up_note: `Call back about the album ${stamp}` });
    // Proposals whose date holds ended: one marked handled, one snoozed past
    // today. Neither is a new inquiry, so neither has a row of its own.
    const ended = shiftDay(today, { days: -2 });
    const handled = await newProject(adminRequest, `Morning handled-${stamp}`);
    await patchProject(handled.id, {
      status: "proposal-sent",
      hold_until: ended,
      today_dismissed: { [`hold:${ended}`]: "handled" },
    });
    const snoozed = await newProject(adminRequest, `Morning snoozed-${stamp}`);
    await patchProject(snoozed.id, {
      status: "proposal-sent",
      hold_until: ended,
      today_dismissed: { [`hold:${ended}`]: shiftDay(today, { days: 3 }) },
    });
    await putSetting("morning-email:2000-01-01", true);

    expect((await runCron(request)).morning).toBe("sent");
    const sent = mornings(await fakes.calls("resend"));
    expect(sent).toHaveLength(1);
    const { subject, text, html } = parts(sent[0]);
    expect(subject.startsWith(`Today, ${formatHumanDate(today, { withYear: false })}: `)).toBe(true);

    // Both of the due project's rows, each with its link on the site's address.
    expect(text).toContain(`\nCall back about the album ${stamp} (due today)\nOpen: ${SITE_URL}/admin/projects/${due.id}\n`);
    expect(text).toContain(`\nDraft a reply: ${SITE_URL}/admin/projects/${due.id}?compose=inquiry-reply#compose\n`);
    expect(text).toContain(`E2E Morning due-${stamp}`);
    expect(html).toContain(`href="${SITE_URL}/admin/projects/${due.id}"`);
    expect(html).toContain(`E2E Morning due-${stamp}`);
    expect(html).toContain(`Call back about the album ${stamp}`);
    // Nothing of the handled or snoozed rows, and no client's address.
    for (const gone of [handled.id, snoozed.id, `Morning handled-${stamp}`, `Morning snoozed-${stamp}`]) {
      expect(text, gone).not.toContain(gone);
      expect(html, gone).not.toContain(gone);
    }
    for (const address of [due.email, handled.email, snoozed.email]) {
      expect(text, address).not.toContain(address);
      expect(html, address).not.toContain(address);
    }
    // One link per row the subject counts (the board's link and the footer's
    // have no project path).
    const count = Number(subject.match(/: (\d+) things? needs? you$/)?.[1]);
    expect(html.split(`href="${SITE_URL}/admin/projects/`).length - 1).toBe(count);
    expect(text).toContain(`Open the board: ${SITE_URL}/admin/projects`);

    expect(sent[0].headers?.["idempotency-key"]).toBe(`morning-email/${today}`);
    expect(await readSetting(claim())).toBe(true);
    expect(await readSetting("morning-email:2000-01-01")).toBeNull();

    // A second run the same day sends nothing more.
    expect((await runCron(request)).morning).toBe("already-sent");
    expect(mornings(await fakes.calls("resend"))).toHaveLength(1);
  });

  test("a failed send is reported, the job carries on, and a later run sends", async ({
    adminRequest,
    request,
    fakes,
  }) => {
    const stamp = Date.now();
    const p = await newProject(adminRequest, `Morning retry-${stamp}`);
    await patchProject(p.id, { follow_up_at: studioToday(), follow_up_note: `Send the timeline ${stamp}` });
    // Every try of the send fails: the first and two retries.
    await fakes.script({ emailFailures: 3 });
    expect(await runCron(request)).toMatchObject({ ok: true, morning: "failed" });
    expect(mornings(await fakes.calls("resend"))).toHaveLength(3);
    // The day was given back.
    expect(await readSetting(claim())).toBeNull();

    expect((await runCron(request)).morning).toBe("sent");
    const sent = mornings(await fakes.calls("resend"));
    expect(sent).toHaveLength(4);
    expect(parts(sent[3]).text).toContain(`Send the timeline ${stamp}`);
  });

  test("two runs at once send one email", async ({ adminRequest, request, fakes }) => {
    const p = await newProject(adminRequest, `Morning twice-${Date.now()}`);
    await patchProject(p.id, { follow_up_at: studioToday(), follow_up_note: "Confirm the venue" });
    const runs = await Promise.all([runCron(request), runCron(request)]);
    expect(runs.map((r) => r.morning).sort()).toEqual(["already-sent", "sent"]);
    expect(mornings(await fakes.calls("resend"))).toHaveLength(1);
  });
});
