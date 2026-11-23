import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

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
  // Headroom for the dev server's cold compile of a page (30-60s with the
  // Sentry client bundle); warm requests are sub-second.
  timeout: 120_000,
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
        AUTH_SECRET: "e2e-test-secret-not-for-production-0123456789abcdef",
        ADMIN_EMAIL: "admin@example.com",
        INQUIRY_TO: "owner@example.com",
        CRON_SECRET: "e2e-cron-secret",
        RESEND_API_KEY: "re_fake_e2e",
        RESEND_BASE_URL: FAKE_URL,
        GROQ_API_KEY: "gsk_fake_e2e",
        AI_BASE_URL: FAKE_URL,
        AI_MODEL: "",
        AI_VISION_MODEL: "",
        TWILIO_ACCOUNT_SID: "",
        TWILIO_AUTH_TOKEN: "",
        TWILIO_PHONE_FROM: "",
        SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? "",
        SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
        // Empty so the autocomplete route returns its deterministic empty list.
        GOOGLE_PLACES_API_KEY: "",
      },
    },
  ],
});
