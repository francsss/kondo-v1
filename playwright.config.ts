import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
// "localhost", not "127.0.0.1": Next.js dev-mode origin checking
// (allowedDevOrigins in next.config.mjs) only trusts localhost and the
// project's explicitly allowed LAN patterns by default, so hydration and
// HMR requests get silently blocked from a 127.0.0.1 origin.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "guest",
      testMatch: /.*\.guest\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testMatch: /.*\.authenticated\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "admin",
      testMatch: /.*\.admin\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        // A production server, not `next dev`: HMR/Fast Refresh churn under
        // several parallel Playwright workers causes full reloads mid-test
        // and flaky hydration races. Build once, then serve statically.
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        // Next needs the same env vars as any other run; forward whatever
        // the shell invoking `playwright test` already has (see
        // e2e/README.md), the same convention `npm test` uses for Vitest.
        env: {
          ...process.env,
          PORT,
          // Exercise local uploads against the production-built test server
          // without external R2 credentials. Storage ignores this escape
          // hatch on Vercel and production environment validation rejects it.
          KONDO_E2E: "true",
        },
      },
});
