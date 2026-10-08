import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:4187",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "msedge",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node --import tsx services/api/server.ts",
      url: "http://127.0.0.1:4329/v1/health",
      env: { CUEVARO_EPHEMERAL: "1" },
      timeout: 30000,
    },
    {
      command: "node scripts/serve-preview.mjs",
      url: "http://127.0.0.1:4187",
      timeout: 30000,
    },
  ],
});
