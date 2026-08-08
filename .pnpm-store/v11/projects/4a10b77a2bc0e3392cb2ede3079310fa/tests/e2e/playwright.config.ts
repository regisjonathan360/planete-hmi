import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
});
