import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function globalSetup(): Promise<void> {
  const root = resolve(__dirname, "../../../..");
  const envTestPath = resolve(root, ".env.test");
  if (existsSync(envTestPath)) {
    const raw = readFileSync(envTestPath, "utf8");
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

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Defina DATABASE_URL (ex.: copie .env.test.example para .env.test na raiz).",
    );
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
  });
  execFileSync("pnpm", ["exec", "prisma", "db", "seed"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env },
  });
}
