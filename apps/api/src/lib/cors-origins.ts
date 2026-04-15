/**
 * Origens comuns do Vite em dev (localhost vs 127.0.0.1 e portas alternadas).
 * Em produção só vale o que estiver em WEB_ORIGIN.
 */
const DEV_VITE_PORTS = [5173, 5174, 5175, 5176, 4173];

function devFallbackOrigins(): string[] {
  const out: string[] = [];
  for (const host of ["http://localhost", "http://127.0.0.1"]) {
    for (const port of DEV_VITE_PORTS) {
      out.push(`${host}:${port}`);
    }
  }
  return out;
}

function originsFromEnv(): string[] {
  return (process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Compatível com `origin` do @fastify/cors (OriginFunction). */
export function buildCorsOrigin() {
  const configured = originsFromEnv();
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && configured.length === 0) {
    return (_origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      callback(null, false);
    };
  }

  const allow = new Set(
    isProd ? configured : [...configured, ...devFallbackOrigins()],
  );

  return (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allow.has(origin));
  };
}
