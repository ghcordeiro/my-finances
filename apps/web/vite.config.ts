import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, "VITE_");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET?.trim() || "http://127.0.0.1:3000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/health": { target: proxyTarget, changeOrigin: true },
        "/v1": { target: proxyTarget, changeOrigin: true },
        "/webhooks": { target: proxyTarget, changeOrigin: true },
      },
    },
  };
});
