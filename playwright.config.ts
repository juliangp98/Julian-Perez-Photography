import { defineConfig, devices } from "@playwright/test";

// E2E smoke tests for the public-facing forms. These run against the
// Next dev server (started by Playwright). The suite relies on the
// dev-mode RESEND_API_KEY-absent fallback in the API routes so nothing
// is actually emailed — the route returns `{ ok: true, dev: true }`
// and logs the payload.
//
// If RESEND_API_KEY is set in the shell, the tests will send real
// emails. Unset it or use `.env.test` conventions before running.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false, // requests share in-memory rate-limit buckets
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Tests interact with native file downloads on /api/wedding-plan.
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Clear RESEND_API_KEY so the dev-mode fallback kicks in — tests
    // must not send real email. (Playwright merges into process.env.)
    env: { RESEND_API_KEY: "" },
  },
});
