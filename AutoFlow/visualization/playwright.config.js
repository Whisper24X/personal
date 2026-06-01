// @ts-check
const { defineConfig } = require("@playwright/test");

// 与默认 4180 错开；本地允许复用已有服务（避免端口已被占用时无法启动），CI 仍要求独占新进程
const testPort = process.env.PLAYWRIGHT_PORT || "4181";
const baseURL = `http://127.0.0.1:${testPort}`;
const reuseOverride = process.env.PLAYWRIGHT_REUSE_SERVER;
const reuseExistingServer =
  reuseOverride === "1" ? true : reuseOverride === "0" ? false : !process.env.CI;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }]
  ],
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry"
  },
  webServer: {
    command: `node server.js`,
    env: { ...process.env, PORT: testPort },
    url: `${baseURL}/api/health`,
    reuseExistingServer,
    timeout: 30_000
  }
});
