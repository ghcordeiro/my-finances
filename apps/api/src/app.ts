import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { orgRoutes } from "./routes/org.js";
import { accountsRoutes } from "./routes/accounts.js";
import { workspacesRoutes } from "./routes/workspaces.js";
import { transfersRoutes } from "./routes/transfers.js";
import { stripeWebhookRoutes } from "./routes/webhooks-stripe.js";
import { requireAuth } from "./plugins/require-auth.js";
import { requireOrgContext } from "./plugins/require-org.js";
import { pingObjectStorage, fingerprintConfig } from "./services/storage.js";
import { assertWithinEntitlement, EntitlementExceededError } from "./services/entitlements.js";
import { buildCorsOrigin } from "./lib/cors-origins.js";

function isStripeWebhookUrl(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return path === "/webhooks/stripe" || path.endsWith("/webhooks/stripe");
}

const DEV_COOKIE_SECRET = "dev-cookie-secret-change-me";

function resolveCookieSecret(): string {
  const raw = process.env.COOKIE_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (isProd) {
    if (!trimmed || trimmed === DEV_COOKIE_SECRET || trimmed === "troque-em-producao" || trimmed.length < 32) {
      throw new Error(
        "COOKIE_SECRET ausente, trivial ou curto demais em produção (mínimo 32 caracteres).",
      );
    }
    return trimmed;
  }
  return trimmed || DEV_COOKIE_SECRET;
}

export async function buildApp() {
  const cookieSecret = resolveCookieSecret();

  const app = Fastify({
    logger:
      process.env.NODE_ENV === "test"
        ? false
        : {
            level: process.env.LOG_LEVEL ?? "info",
            transport:
              process.env.NODE_ENV === "development"
                ? { target: "pino-pretty", options: { colorize: true } }
                : undefined,
          },
  });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      request.rawBody = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      if (isStripeWebhookUrl(request.url)) {
        done(null, body);
        return;
      }
      try {
        if (body.length === 0) {
          done(null, {});
          return;
        }
        const json = JSON.parse(body.toString("utf8"));
        done(null, json);
      } catch (e) {
        done(e as Error, undefined);
      }
    },
  );

  await app.register(cookie, {
    secret: cookieSecret,
  });

  await app.register(cors, {
    origin: buildCorsOrigin(),
    credentials: true,
  });

  app.get("/health", async (_request, reply) => {
    await reply.send({ status: "ok" });
  });

  await app.register(
    async (authScope) => {
      const max = Number(process.env.RATE_LIMIT_AUTH_MAX ?? "120");
      const windowMs = Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? `${60_000}`);
      await authScope.register(rateLimit, {
        max,
        timeWindow: windowMs,
        keyGenerator: (request) => {
          const ip = request.ip;
          const body = request.body as { email?: string } | undefined;
          const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";
          return `${ip}:${email}`;
        },
      });
      await authScope.register(authRoutes, { prefix: "/v1/auth" });
    },
    { prefix: "" },
  );

  await app.register(meRoutes, { prefix: "/v1" });
  await app.register(orgRoutes, { prefix: "/v1" });
  await app.register(workspacesRoutes, { prefix: "/v1" });
  await app.register(accountsRoutes, { prefix: "/v1" });
  await app.register(transfersRoutes, { prefix: "/v1" });

  await app.register(
    async (r) => {
      r.get(
        "/storage/ping",
        { preHandler: [requireAuth, requireOrgContext] },
        async (request, reply) => {
          const ping = await pingObjectStorage();
          await reply.send({
            organizationId: request.organizationId,
            fingerprint: fingerprintConfig(),
            storage: ping,
          });
        },
      );

      r.get(
        "/billing/entitlement-probe",
        { preHandler: [requireAuth, requireOrgContext] },
        async (request, reply) => {
          const q = request.query as { count?: string };
          const count = Number(q.count ?? "0");
          try {
            await assertWithinEntitlement(request.organizationId!, "max_workspaces", count);
            await reply.send({ ok: true });
          } catch (e) {
            if (e instanceof EntitlementExceededError) {
              await reply.status(403).send({ error: "entitlement_exceeded", message: e.message });
              return;
            }
            throw e;
          }
        },
      );
    },
    { prefix: "/v1" },
  );

  await app.register(stripeWebhookRoutes, { prefix: "/webhooks" });

  return app;
}
