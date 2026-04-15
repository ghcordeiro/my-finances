import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const e2eWebPort = process.env.E2E_WEB_PORT ?? "5188";
const e2eApiPort = process.env.E2E_API_PORT ?? "3109";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${e2eWebPort}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node ${path.join(root, "scripts/e2e-serve.mjs")}`,
    url: `http://127.0.0.1:${e2eWebPort}/`,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
    cwd: root,
    env: {
      ...process.env,
      E2E_WEB_PORT: e2eWebPort,
      E2E_API_PORT: e2eApiPort,
    },
  },
});
