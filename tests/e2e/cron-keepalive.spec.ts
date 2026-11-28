import type { APIRequestContext } from "@playwright/test";
import { test, expect, hasTestStore, type FakeCall } from "./support/fixtures";

// The daily cron (/api/cron/keepalive): one query against the client store so
// the Supabase free tier never pauses, a delivery check for thread messages,
// and a fresh pick of AI models from the provider's catalogue. Guarded by
// CRON_SECRET, which Vercel sends as a bearer. The model checks run against the
// fake catalogue and need the test store, where the choice is kept.

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
