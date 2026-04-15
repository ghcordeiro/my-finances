# My Finances — plataforma (M0)

Monorepo `pnpm` com API **Fastify** + **Prisma/Postgres** e SPA **Vite/React** para cadastro/login e shell autenticado.

## Pré-requisitos

- Node 22+ (LTS recomendado)
- `pnpm` 9+
- Docker (Postgres local)

## Banco de dados

```bash
docker compose up -d
cp .env.test.example .env.test
# Ajuste DATABASE_URL se necessário
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

## Variáveis

Veja `.env.example`. **Nunca** commite segredos reais.

- `STRIPE_WEBHOOK_SECRET` — obrigatório para `POST /webhooks/stripe` em ambientes com Stripe.
- `BILLING_PROVIDER=none` — modo dev sem Stripe; novas orgs recebem `plan_code=trial`.
- `S3_*` — opcional; `GET /v1/storage/ping` retorna modo `skipped` se não configurado.

## Scripts

| Comando | Descrição |
|--------|------------|
| `pnpm dev` | API em `http://127.0.0.1:3000` |
| `pnpm dev:web` | SPA em `http://localhost:5173` — em dev, `/v1` e `/health` são **proxied** para a API (cookie na mesma origem). Use `VITE_API_URL` só se quiser chamar a API direto (ex.: build) |
| `pnpm test` | Vitest (integração) — exige Postgres e `.env.test` |
| `pnpm test:e2e` | Playwright (sobe API+web via `scripts/e2e-serve.mjs`) |

### Testes

1. Suba o Postgres (`docker compose up -d`).
2. Copie `.env.test.example` → `.env.test`.
3. `pnpm install` (gera Prisma Client no `postinstall`).
4. `pnpm test`.

**Rate limit (T-TEST-011):** `RATE_LIMIT_AUTH_MAX` padrão 120; o teste usa `3` temporariamente.

## Contratos úteis (M0)

- `GET /health` — health check.
- `POST /v1/auth/register` — cria usuário, organização (owner) e assinatura `trial` (modo `none`).
- `POST /v1/auth/login` | `POST /v1/auth/logout` | `GET /v1/me`.
- `GET /v1/organizations` — lista orgs do usuário autenticado.
- Rotas de domínio exigem `X-Organization-Id` (ver ADR-0006), exceto listagem de orgs.
- `GET /v1/organizations/:id/export` — **501** `{ "status": "not_implemented", "issue": "RF-PLT-07" }` (stub M0).

### Exclusão de organização / dados (futuro)

Fluxo definitivo será **assíncrono** (fila + período de retenção legal). O stub de export acima documenta o contrato mínimo até RF-PLT-07 completo.

## Especificações

Artefatos em `.specs/` (SDD). ADRs em `docs/adr/`.
