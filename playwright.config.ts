import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { WEBHOOK_SECRET } from "./tests/e2e/support/webhook-sign";
import { AUTH_SECRET } from "./tests/e2e/support/auth-secret";

// The suite only ever talks to stand-ins. Provider calls (Resend, the AI
// provider, Twilio) go to tests/e2e/support/fake-providers.mjs, and the client
// store is a separate test Supabase project whose keys live in .env.test as
// TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY. Shell values for the real
// keys are overridden below, and the app runs on its own port so an ordinary
// `npm run dev` on :3000 (with real keys) is never reused by mistake.
if (existsSync(".env.test")) process.loadEnvFile(".env.test");

const APP_PORT = 3100;
const FAKE_PORT = Number(process.env.FAKE_PROVIDERS_PORT ?? 4010);
const FAKE_URL = `http://localhost:${FAKE_PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/support/reset-test-store.ts",
  // Headroom for the dev server's cold compile of a page (30-60s with the
  // Sentry client bundle); warm requests are sub-second.
  timeout: 120_000,
  // The same headroom for what a page shows after an action, which can wait on
  // a compile in dev; the production build in CI is quick.
  expect: { timeout: CI ? 5_000 : 15_000 },
  // One worker: the fake providers keep one shared record of calls, and specs
  // assert on it.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
    actionTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/support/fake-providers.mjs",
      url: `${FAKE_URL}/__health`,
      reuseExistingServer: !CI,
      timeout: 10_000,
      env: { FAKE_PROVIDERS_PORT: String(FAKE_PORT) },
    },
    {
      command: CI
        ? `npm run build && npx next start -p ${APP_PORT}`
        : `npx next dev -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !CI,
      timeout: CI ? 300_000 : 120_000,
      env: {
        AUTH_SECRET,
        ADMIN_EMAIL: "admin@example.com",
        INQUIRY_TO: "owner@example.com",
        CRON_SECRET: "e2e-cron-secret",
        RESEND_API_KEY: "re_fake_e2e",
        RESEND_BASE_URL: FAKE_URL,
        RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET,
        RESEND_INBOUND_DOMAIN: "in.example.test",
        GROQ_API_KEY: "gsk_fake_e2e",
        AI_BASE_URL: FAKE_URL,
        AI_MODEL: "",
        AI_FALLBACK_MODEL: "",
        AI_VISION_MODEL: "",
        TWILIO_ACCOUNT_SID: "ACfake_e2e",
        TWILIO_AUTH_TOKEN: "fake_e2e",
        TWILIO_PHONE_FROM: "+15555550100",
        TWILIO_BASE_URL: FAKE_URL,
        INQUIRY_SMS_TO: "+15555550199",
        SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? "",
        SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
        // Empty so the autocomplete route returns its deterministic empty list.
        GOOGLE_PLACES_API_KEY: "",
        // Empty so content (site settings, services) comes from the built-in
        // fallback in every run, whatever a local .env.local holds.
        NEXT_PUBLIC_SANITY_PROJECT_ID: "",
        // Empty so the owner's portal alerts stay on (the default), whatever a
        // local .env.local holds.
        NOTIFY_CLIENT_EDITS: "",
        // Empty so client mail comes from the default sender (julian@) and
        // alerts from noreply@, whatever a local .env.local holds.
        RESEND_FROM: "",
      },
    },
  ],
});
