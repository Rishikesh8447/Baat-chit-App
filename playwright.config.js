import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "cmd /c npm run start --prefix backend",
      url: "http://127.0.0.1:5001/api/auth/check",
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: "5001",
        FRONTEND_URL: "http://127.0.0.1:4173",
        ENABLE_E2E_TESTS: "true",
        AUTH_RATE_LIMIT_MAX: "200",
        MESSAGE_RATE_LIMIT_MAX: "200",
      },
      timeout: 120_000,
    },
    {
      command: "cmd /c npm run dev --prefix frontend -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
