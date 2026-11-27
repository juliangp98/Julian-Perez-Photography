import { test, expect, type FakeCall } from "./support/fixtures";
import { services } from "../../src/lib/services-data";

// The website copy drafter (/api/admin/draft-copy): a journal post from a
// topic, or a service or portfolio page's copy from what's live, to review and
// paste into Studio. It never publishes. Owner-only and rate-limited; replies
// come from the fake AI provider, scripted where a draft should read.

const COPY = { tagline: "Your day, as it was", description: "Wedding photography, told as it happened.", intro: ["One."] };
const POST = { title: "Why I shoot documentary weddings", excerpt: "A short teaser.", body: "One.\n\nTwo.", tags: ["weddings"] };
const chats = (calls: FakeCall[]) => calls.filter((c) => c.path === "/chat/completions");

test("draft-copy: rejects an unauthenticated request of either kind", async ({ request }) => {
  for (const data of [
    { kind: "service", slug: "weddings", mode: "tighten" },
    { kind: "journal", topic: "A topic" },
  ]) {
    const res = await request.post("/api/admin/draft-copy", { headers: { "x-forwarded-for": "10.99.15.1" }, data });
    expect(res.status(), data.kind).toBe(401);
  }
});

test("draft-copy: rejects a malformed body when authenticated", async ({ adminRequest: request }) => {
  for (const data of [
    { kind: "service", slug: "weddings" }, // no mode
    { kind: "journal" }, // no topic
    { kind: "journal", topic: "   " }, // a blank topic
    { kind: "meta", page: "home" }, // the retired meta drafter's kind
    { page: "home" }, // the retired meta drafter's body
  ]) {
    const res = await request.post("/api/admin/draft-copy", { data });
    expect(res.status(), JSON.stringify(data)).toBe(400);
  }
});

test("draft-copy: a page the site doesn't show is no draft, before any provider call", async ({
  adminRequest: request,
  fakes,
}) => {
  for (const slug of ["this-service-does-not-exist", "modeling"]) {
    const res = await request.post("/api/admin/draft-copy", { data: { kind: "service", slug, mode: "tighten" } });
    expect(res.status(), slug).toBe(200);
    expect(await res.json(), slug).toEqual({ ok: true, drafted: false });
  }
  expect(chats(await fakes.calls("ai"))).toEqual([]);
});

test("draft-copy: a service page's copy is drafted from what's live, with the writing rules", async ({
  adminRequest: request,
  fakes,
}) => {
  await fakes.script({ replies: [JSON.stringify(COPY)] });
  const res = await request.post("/api/admin/draft-copy", {
    data: { kind: "service", slug: "weddings", mode: "tighten" },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, drafted: true, copy: COPY });
  const sent = JSON.stringify((chats(await fakes.calls("ai"))).at(-1)?.body);
  expect(sent).toContain(services.find((s) => s.slug === "weddings")!.tagline!);
  expect(sent).toContain("No em dashes");
  expect(sent).toContain("Never use these words or phrases");
});

test("draft-copy: a journal post is drafted from its topic and type, with the writing rules", async ({
  adminRequest: request,
  fakes,
}) => {
  await fakes.script({ replies: [JSON.stringify(POST)] });
  const res = await request.post("/api/admin/draft-copy", {
    data: { kind: "journal", topic: "  Documentary weddings  ", postType: "Personal essay" },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, drafted: true, post: POST });
  const sent = JSON.stringify((chats(await fakes.calls("ai"))).at(-1)?.body);
  expect(sent).toContain("Documentary weddings");
  expect(sent).toContain("Post type: Personal essay");
  expect(sent).toContain("No em dashes");
});

test("draft-copy: a reply that isn't the draft asked for says so", async ({ adminRequest: request }) => {
  // Unscripted, the fake provider answers with plain text, not JSON.
  for (const data of [
    { kind: "service", slug: "weddings", mode: "tighten" },
    { kind: "journal", topic: "A topic" },
  ]) {
    const res = await request.post("/api/admin/draft-copy", { data });
    expect(res.status(), data.kind).toBe(502);
    expect((await res.json()).error, data.kind).toBe("Couldn't read the draft. Try again.");
  }
});

test("the retired journal and meta drafting routes are gone", async ({ adminRequest: request }) => {
  for (const path of ["/api/admin/draft-journal", "/api/admin/draft-meta"]) {
    const res = await request.post(path, { data: { topic: "A topic", page: "home" } });
    expect(res.status(), path).toBe(404);
  }
});
