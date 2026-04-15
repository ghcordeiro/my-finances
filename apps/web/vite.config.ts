import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "VITE_");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET?.trim() || "http://127.0.0.1:3000";
  const devPort = Number(env.VITE_DEV_SERVER_PORT ?? process.env.VITE_DEV_SERVER_PORT ?? 5173);
  const strictDevPort = Boolean(env.VITE_DEV_SERVER_PORT ?? process.env.VITE_DEV_SERVER_PORT);

  return {
    plugins: [react()],
    server: {
      port: Number.isFinite(devPort) ? devPort : 5173,
      strictPort: strictDevPort,
      /** E2E usa `waitHealth` / Playwright com 127.0.0.1 — forçar bind explícito. */
      host: strictDevPort ? "127.0.0.1" : undefined,
      proxy: {
        "/health": { target: proxyTarget, changeOrigin: true },
        "/v1": { target: proxyTarget, changeOrigin: true },
        "/webhooks": { target: proxyTarget, changeOrigin: true },
      },
    },
  };
});
