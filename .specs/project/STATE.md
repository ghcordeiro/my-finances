# STATE — My Finances

## Última atualização

- 2026-04-15: **Auditoria SDD pré-M1 Implement** — brechas identificadas e fixes 1–4 aplicados: `STATE.md` sincronizado; `COOKIE_SECRET` com asserção em produção (`apps/api/src/app.ts`); lint soft-fail removido em favor de `typecheck` real; CI mínimo em `.github/workflows/ci.yml` (Postgres + migrate + typecheck + test).
- 2026-04-15: **Gate Plan (M1) concluído** — `plan.md` aprovado; ADRs `0007` e `0008` aceitos. `tasks.md` redigido (TDAD); aguardando **gate Tasks → Implement**.
- 2026-04-15: **Design Stitch nos docs** — contrato em `docs/design/` (índice `docs/design/README.md`), referência cruzada em `CONSTITUTION.md`, `PROJECT.md`, `product-v1/spec.md` (`RNF-UI-01`), spec M1 e `ROADMAP` M1; C4 M0 com nota na Web App.
- 2026-04-15: **Plan M1** — `.specs/features/m1-workspaces-core/plan.md`; ADRs `0007`, `0008`; C4 `docs/architecture/c4-m1-workspaces.md`.
- 2026-04-15: **Specify M1** — `.specs/features/m1-workspaces-core/spec.md` (workspaces PF/PJ, contas, transferências).
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
- [x] **Gate Specify (M1):** spec aprovado implicitamente ao avançar para Plan.
- [x] **Gate Plan (M1):** `plan.md` aprovado; ADRs 0007/0008 aceitos (2026-04-15).
- [ ] **Gate Tasks → Implement (M1):** revisar e aprovar `.specs/features/m1-workspaces-core/tasks.md` antes de iniciar implementação.
- [ ] **M1 Implement:** ondas TDAD M1-I-001…M1-I-009 após gate Tasks.
- [ ] (Opcional) Rodar e fixar `pnpm test:e2e` em CI; Playwright + stack `scripts/e2e-serve.mjs`.

## Brechas de auditoria pendentes (pós-fixes 1–4 + 6–7)

- [ ] **Fix 5:** tornar `PlanEntitlement` extensível (não só `maxWorkspaces`) — ADR complementar antes de M4.
- [x] **Fix 6 (2026-04-15):** ADR-0007 §4 reescrito — modo primário Serializable + retry 3× com backoff; fallback explícito `READ COMMITTED` + `SELECT … FOR UPDATE` ordenado por `accountId` ASC documentado.
- [x] **Fix 7 (2026-04-15):** `M1-I-001` e `M1-T-001` atualizados para incluir **data migration retro** (backfill `personal` para orgs sem workspace) + invariante testado.
- [ ] **Fix 8:** revisar `webhooks-stripe.ts` para `current_period_end` vindo de `sub.items.data[0]` conforme API Stripe atual.
- [ ] Decidir/ADR: IdP gerenciado, modelo de preço, residência de dados, política LLM operacional.
- [ ] Alinhar `PRD.md` do root com `.specs/features/product-v1/spec.md` (ou remover PRD do root).

## Integrações

- Linear: não configurado nesta sessão; hooks Pre/Post-Linear ignorados.
