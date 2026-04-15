import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Portas fora do dev habitual (3000 / 5173) para evitar EADDRINUSE ao correr E2E com stack local. */
const apiPort = process.env.E2E_API_PORT ?? "3109";
const webPort = process.env.E2E_WEB_PORT ?? "5188";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(resolve(root, ".env.test"));
loadEnvFile(resolve(root, ".env"));

function waitHealth(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolvePromise, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolvePromise();
      } catch {
        /* ignore */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout aguardando ${url}`));
        return;
      }
      setTimeout(tick, 250);
    };
    void tick();
  });
}

const api = spawn("pnpm", ["--filter", "@my-finances/api", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: apiPort,
    WEB_ORIGIN: `http://127.0.0.1:${webPort}`,
  },
});

let web = null;

const shutdown = () => {
  try {
    web?.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    api.kill("SIGTERM");
  } catch {
    /* ignore */
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await waitHealth(`http://127.0.0.1:${apiPort}/health`, 90_000);

web = spawn("pnpm", ["--filter", "@my-finances/web", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    VITE_DEV_SERVER_PORT: webPort,
  },
});

web.on("exit", () => {
  shutdown();
  process.exit(0);
});

api.on("exit", (code) => {
  if (code && code !== 0) process.exit(code);
});

await waitHealth(`http://127.0.0.1:${webPort}/`, 90_000);
