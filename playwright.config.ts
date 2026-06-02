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
  // 120s ceiling per test. Plenty of headroom for the dev server's
  // cold Turbopack compile of any single page, which can run 30-60s
  // on a fresh suite start when the client bundle includes the
  // Sentry SDK + Replay integration. Real submission round-trips are
  // sub-second after warm-up.
  timeout: 120_000,
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
    // AUTH_SECRET is a throwaway test value so the portal auth routes +
    // proxy function; it is never used outside the local test server.
    env: {
      RESEND_API_KEY: "",
      AUTH_SECRET: "e2e-test-secret-not-for-production-0123456789abcdef",
      ADMIN_EMAIL: "admin@example.com",
      // Blank the client store so the suite never reads or writes the real
      // Supabase database — capture + portal cleanly no-op during tests.
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
