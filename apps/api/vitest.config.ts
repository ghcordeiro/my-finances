import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    pool: "forks",
    globalSetup: ["src/__tests__/global-setup.ts"],
    globalTeardown: ["src/__tests__/global-teardown.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
