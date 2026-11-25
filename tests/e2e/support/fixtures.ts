import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// Shared fixtures for the e2e suite:
// - every request from a test carries its own x-forwarded-for, so the
//   in-memory rate-limit buckets never collide between tests;
// - `adminRequest`, `adminPage`, `portalRequest(email)` and `portalPage(email)`
//   arrive signed in;
// - `fakes` reads and steers the stand-in providers (tests/e2e/support/
//   fake-providers.mjs); it resets before every test.

export const ADMIN_EMAIL = "admin@example.com";
export const FAKE_PROVIDERS_URL = `http://localhost:${process.env.FAKE_PROVIDERS_PORT ?? 4010}`;
// Store-backed specs need the separate test Supabase project (.env.test).
export const hasTestStore = !!(
  process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
);

type Provider = "resend" | "ai" | "twilio";
export type FakeCall = {
  provider: Provider;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
};
type Fakes = {
  calls(provider?: Provider): Promise<FakeCall[]>;
  script(script: {
    replies?: string[];
    models?: unknown[];
    retired?: string[];
    emailFailures?: number;
  }): Promise<void>;
  inbound(email: Record<string, unknown>): Promise<void>;
};

function ipFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}

// The sign-in link from the most recent email the fake Resend received for
// `email` — the same link a real inbox would get.
export async function magicLinkFor(email: string): Promise<string> {
  const res = await fetch(`${FAKE_PROVIDERS_URL}/__calls?provider=resend`);
  const calls = (await res.json()) as FakeCall[];
  const sent = calls
    .filter((c) => c.path === "/emails" && [c.body?.to].flat().includes(email))
    .at(-1);
  const link = String(sent?.body?.text ?? "").match(/https?:\/\/\S+\/verify\?token=\S+/)?.[0];
  expect(link, `no sign-in email reached ${email}`).toBeTruthy();
  return link!;
}

// The session cookie arrives on the verify redirect, so the redirect isn't
// followed: that would render the landing page, which is slow on a cold compile
// and says nothing about the test at hand.
async function signIn(request: APIRequestContext, path: string, email: string) {
  await request.post(path, { data: { email, hp_company: "" } });
  const res = await request.get(await magicLinkFor(email), { maxRedirects: 0 });
  expect(res.headers()["set-cookie"], `no session cookie for ${email}`).toBeTruthy();
}

export const test = base.extend<{
  clientIp: string;
  adminRequest: APIRequestContext;
  adminPage: Page;
  portalRequest: (email: string) => Promise<APIRequestContext>;
  portalPage: (email: string) => Promise<Page>;
  fakes: Fakes;
}>({
  clientIp: async ({}, provide, testInfo) => {
    await provide(ipFor(testInfo.testId));
  },
  extraHTTPHeaders: async ({ extraHTTPHeaders, clientIp }, provide) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": clientIp });
  },
  adminRequest: async ({ request }, provide) => {
    await signIn(request, "/api/admin/request-link", ADMIN_EMAIL);
    await provide(request);
  },
  // A browser page that shares the signed-in admin session.
  adminPage: async ({ page }, provide) => {
    await signIn(page.request, "/api/admin/request-link", ADMIN_EMAIL);
    await provide(page);
  },
  portalRequest: async ({ request }, provide) => {
    await provide(async (email) => {
      await signIn(request, "/api/portal/request-link", email);
      return request;
    });
  },
  // The browser page signed in to the portal as `email` (a client, or a second
  // photographer with access). Signing in again as someone else replaces the
  // session, so one test can look at a project as each of them in turn.
  portalPage: async ({ page }, provide) => {
    await provide(async (email) => {
      await signIn(page.request, "/api/portal/request-link", email);
      return page;
    });
  },
  // Automatic, so every test starts with an empty record of provider calls
  // (and it resets before the sign-in fixtures read their email).
  fakes: [async ({ playwright }, provide) => {
    const ctx = await playwright.request.newContext({ baseURL: FAKE_PROVIDERS_URL });
    await ctx.delete("/__calls");
    await provide({
      calls: async (provider) =>
        (await ctx.get(`/__calls${provider ? `?provider=${provider}` : ""}`)).json(),
      script: async (script) => {
        await ctx.post("/__script", { data: script });
      },
      inbound: async (email) => {
        await ctx.post("/__inbound", { data: email });
      },
    });
    await ctx.dispose();
  }, { auto: true }],
});

export { expect };
