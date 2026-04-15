#!/usr/bin/env node
/**
 * Baixa HTML (e metadados) das telas do projeto Stitch "My Finances" para
 * docs/design/stitch-reference/screens/ — uso offline como referência visual.
 *
 * Requer: STITCH_API_KEY no ambiente ou em .env (raiz do repo).
 * Chave: https://stitch.withgoogle.com/settings
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const REF_DIR = path.join(root, "docs/design/stitch-reference");
const SCREENS_DIR = path.join(REF_DIR, "screens");

const DEFAULT_PROJECT_ID =
  process.env.STITCH_PROJECT_ID?.trim() || "14496089392956455810";

/** Rota SPA alvo por `screenId` — ajuste se o Stitch gerar telas novas. */
const APP_ROUTE_HINTS = {
  "5f91ef71d5b04bbf9cc398acb9555c81": "/app/workspaces (M1)",
  "1ee9cea3e5c0471aa51a1aaa4d5bc717": "/app/transfers (M1)",
  "51108684a3314c5fb2cc79b66c2328b6": "/app/accounts (M1)",
  "62d1c67602c048f6b7d073ac150c05cc": "/login, /register",
  "4a0662a21100475dbf7ec437ae470720": "/app/settings/organization (M0/M1)",
};

function loadApiKey() {
  const fromEnv = process.env.STITCH_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const raw = fs.readFileSync(path.join(root, ".env"), "utf8");
    const m = raw.match(/^\s*STITCH_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env */
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"));
    const h = cfg.mcpServers?.stitch?.headers?.["X-Goog-Api-Key"];
    if (typeof h === "string" && h.length > 8 && !h.includes("${")) return h.trim();
  } catch {
    /* no .mcp.json */
  }
  return null;
}

async function mcpCall(key, name, args) {
  const res = await fetch("https://stitch.googleapis.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  const text = j.result?.content?.[0]?.text;
  if (text) return JSON.parse(text);
  return j.result?.structuredContent ?? j.result;
}

function slugify(s) {
  return String(s || "screen")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "screen";
}

async function downloadFile(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download ${dest}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  const key = loadApiKey();
  if (!key) {
    console.error(
      "Defina STITCH_API_KEY (env ou .env na raiz) ou coloque a chave literal em .mcp.json.",
    );
    process.exit(1);
  }

  fs.mkdirSync(SCREENS_DIR, { recursive: true });

  const listed = await mcpCall(key, "list_screens", { projectId: DEFAULT_PROJECT_ID });
  const screens = listed.screens ?? [];
  if (!screens.length) {
    console.error("Nenhuma tela retornada por list_screens.");
    process.exit(1);
  }

  const manifest = {
    syncedAt: new Date().toISOString(),
    stitchProjectTitle: "My Finances Unified Manager",
    stitchProjectId: DEFAULT_PROJECT_ID,
    screens: [],
  };

  for (const s of screens) {
    const name = s.name;
    const parts = name.split("/");
    const projectId = parts[1];
    const screenId = parts[3];
    const detail = await mcpCall(key, "get_screen", {
      name,
      projectId,
      screenId,
    });
    const title = detail.title ?? screenId;
    const slug = slugify(title);
    const base = path.join(SCREENS_DIR, `${slug}-${screenId.slice(0, 8)}`);
    const entry = {
      screenId,
      title,
      slug,
      appRouteHint: APP_ROUTE_HINTS[screenId] ?? null,
      status: detail.screenMetadata?.status ?? null,
      htmlPath: null,
      screenshotPath: null,
    };
    if (detail.htmlCode?.downloadUrl) {
      entry.htmlPath = `${path.basename(base)}.html`;
      await downloadFile(detail.htmlCode.downloadUrl, `${base}.html`);
    }
    if (detail.screenshot?.downloadUrl) {
      const shot = `${base}.png`;
      try {
        await downloadFile(detail.screenshot.downloadUrl, shot);
        entry.screenshotPath = `${path.basename(base)}.png`;
      } catch (e) {
        console.warn("Screenshot omitido:", title, e instanceof Error ? e.message : e);
      }
    }
    manifest.screens.push(entry);
    console.log("OK", title);
  }

  fs.writeFileSync(path.join(REF_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log("Manifest:", path.join(REF_DIR, "manifest.json"));
}

await main();
