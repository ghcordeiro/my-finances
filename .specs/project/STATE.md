# STATE — My Finances

## Última atualização

- 2026-04-15: PRD ingerido via `/spec-driven`; artefatos iniciais em `.specs/project/` e `features/product-v1/spec.md`.
- 2026-04-15: **Premissa explícita — SaaS desde o início:** constituição, projeto, roadmap e spec atualizados para multi-tenant, identidade, faturação de plataforma e isolamento; roadmap ganhou **M0 Plataforma**.
- 2026-04-15: **Fase Plan concluída** para incremento M0: `.specs/features/product-v1/plan.md`, ADRs `0001`–`0006` em `docs/adr/`, C4 L1+L2 em `docs/architecture/c4-platform-m0.md`. Spec aprovada pelo usuário antes do Plan.
- 2026-04-15: **`plan.md` aprovado** pelo usuário; criado `.specs/features/product-v1/tasks.md` (fase Tasks, TDAD).
- 2026-04-15: **M0 encerrado (implementação):** monorepo `apps/api` + `apps/web`, Prisma/Postgres, auth (register/login/logout/me), contexto `X-Organization-Id`, isolamento CA-00, audit append, Stripe webhook idempotente, billing stub + entitlements, storage (chave + ping S3), rate limit em `/v1/auth`, stub export RF-PLT-07, SPA com proxy Vite para cookie em dev; Vitest verde. **Não entregue neste fechamento (intencional ou M0.1+):** fluxo de recuperação de senha, verificação de e-mail transacional, convite de membro (ver `tasks.md` opcional), E2E Playwright como gate obrigatório de CI (script `pnpm test:e2e` disponível).

## Decisões tomadas (Plan / ADRs)

- Multi-tenant: **PostgreSQL compartilhado + `organization_id`** em todas as linhas; RLS como evolução opcional (ADR-0001).
- Auth M0: **e-mail + senha**, Argon2id, **sessão opaca em DB** (ADR-0002); OIDC fora do M0.
- Stack inicial: **Node.js + TypeScript + Fastify + Prisma + PostgreSQL** (ADR-0003).
- Objetos: **S3-compatível**, chaves prefixadas por org (ADR-0004).
- Billing: **Stripe** + webhooks idempotentes; modo `BILLING_PROVIDER=none` só dev (ADR-0005).
- API: **`X-Organization-Id`** obrigatório em rotas de domínio (ADR-0006).

## Decisões ainda abertas (pós-M0 ou ADR futuro)

- IdP gerenciado (Clerk/Auth0) vs. manter auth própria em escala.
- Modelo de preço (seat vs. org vs. workspace) e tabela de limites finais.
- Residência de dados (região única vs. multi-região).
- Política LLM operacional (BYOK, DPA, processadores permitidos).

## Bloqueadores

- Nenhum.

## Próximos todos

- [x] Gate Specify → Plan (spec aprovada; plano M0 entregue).
- [x] Gate Plan → Tasks (`plan.md` aprovado; `tasks.md` gerado).
- [x] **Gate Tasks → Implement:** `tasks.md` aprovado; ondas 0–12 implementadas conforme grafo.
- [ ] **M1:** Specify/Plan/Tasks do núcleo workspaces + domínio financeiro (ver `ROADMAP.md`).
- [ ] (Opcional) Rodar e fixar `pnpm test:e2e` em CI; Playwright + stack `scripts/e2e-serve.mjs`.

## Integrações

- Linear: não configurado nesta sessão; hooks Pre/Post-Linear ignorados.
