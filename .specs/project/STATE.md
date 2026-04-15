# STATE — My Finances

## Última atualização

- 2026-04-15: **M3 — marco encerrado (API)** — migração `m3_import_ofx_csv_domain`; motores OFX/CSV; `import-process` / `import-apply`; rotas imports + csv-templates; saldo com `AccountImportPosting`; testes Vitest (58) verdes com `pnpm test`; ADR **0011** / **0012** em **Aceito — M3 concluído**; logs estruturados no POST de imports (`importBatchId`, `workspaceId`, `targetAccountId`, contagens). **M3.1** (UI/E2E) mantido em backlog em `tasks.md`. Próximo SDD: **M4** (categorização) quando planeado.
- 2026-04-15: **M3 — Gate Tasks concluído** — [`.specs/features/m3-import-ofx-csv/tasks.md`](../features/m3-import-ofx-csv/tasks.md) **aprovado** pelo utilizador. **Gate Tasks → Implement:** **autorizado** — executar ondas M3-T / M3-I conforme grafo e checklist de fecho em `tasks.md`.
- 2026-04-15: **M3 — `tasks.md` redigido** — [`.specs/features/m3-import-ofx-csv/tasks.md`](../features/m3-import-ofx-csv/tasks.md) (TDAD, grafo M3-T/M3-I, checklist fecho).
- 2026-04-15: **M3 — Gate Plan concluído** — [`.specs/features/m3-import-ofx-csv/plan.md`](../features/m3-import-ofx-csv/plan.md) **aprovado** pelo utilizador; ADR **0011** / **0012** em estado **Aceito — Gate Plan M3**; C4 `docs/architecture/c4-m3-import-ofx-csv.md`. **Tasks** entregues em rascunho (ver entrada imediatamente acima).
- 2026-04-15: **M3 — Plan redigido (rascunho)** — [`.specs/features/m3-import-ofx-csv/plan.md`](../features/m3-import-ofx-csv/plan.md); ADR **0011** (domínio), **0012** (API); C4 `docs/architecture/c4-m3-import-ofx-csv.md`. **Gate Plan:** aguarda aprovação explícita do utilizador.
- 2026-04-15: **M3 — Gate Specify concluído** — [`.specs/features/m3-import-ofx-csv/spec.md`](../features/m3-import-ofx-csv/spec.md) **aprovado** pelo utilizador; autorizada fase **Plan** (M3): `plan.md`, ADRs e C4 conforme spec-driven.
- 2026-04-15: **M2 encerrado; M3 iniciado (Specify)** — checklist de fecho em `m2-cards-billing/tasks.md` marcado; ADR-0009/0010 **Aceito — M2 concluído**; `ROADMAP` M2 como concluído. Novo spec rascunho: [`.specs/features/m3-import-ofx-csv/spec.md`](./../features/m3-import-ofx-csv/spec.md) (importação OFX/CSV, RF-IMP, CA-02). Backlog **M2.1** (UI cartões, E2E, testes CA extras) documentado em `tasks.md` M2.
- 2026-04-15: **M2 — Implement (API)** — migrações `m2_credit_card_billing` + `scheduled`; domínio `billing-calendar` (Luxon); serviços/rotas cartões, faturas, compras, créditos, antecipação, PATCH pago; `TEST_BILLING_AS_OF`; testes `migration-m2`, `credit-cards-m2`, isolamento cartões.
- 2026-04-15: **M2 — Tasks** — `tasks.md` (TDAD). Plan aprovado. **Gate Tasks → Implement** concluído.
- 2026-04-15: **M2 — Plan** — `plan.md`, ADR-0009/0010, C4 `c4-m2-cards-billing.md` (aprovado pelo utilizador).
- 2026-04-15: **M1 encerrado** — checklist em `m1-workspaces-core/tasks.md` marcado; `ROADMAP.md` M1 como concluído; ADRs `0007`/`0008` em estado **Aceito**; E2E `M1-T-009` (workspaces → contas) em `apps/web/e2e/onboarding.spec.ts`; `pnpm test` + `pnpm test:e2e` verdes (E2E usa portas **3109/5188** via `e2e-serve.mjs` + `VITE_DEV_SERVER_PORT`). Próximo marco SDD: **M2** (Plan → Tasks → Implement).
- 2026-04-15: **M1-I-009 Web (Stitch-aligned)** — shell com sidebar; rotas `/app` (dashboard), `/app/workspaces`, `/app/workspaces/:id/accounts|transfers`, `/app/organization`; cliente `api.ts` com `X-Organization-Id`, tipos M1 e `ApiError`; tokens/layout existentes (`mf-layout.css`, Stitch tokens).
- 2026-04-15: **M1 API core (workspaces, contas, transferências, auditoria)** — `POST /v1/auth/register` cria workspace `personal` default; rotas `GET|POST|PATCH /v1/workspaces`, contas aninhadas, `POST /v1/transfers` + `GET .../transfers` (Serializable + retry); testes Vitest M1-T-002…007 + isolamento; webhook Stripe: `current_period_end` via subscription ou primeiro item.
- 2026-04-15: **Gate Tasks → Implement (M1) concluído** — aprovação explícita de `.specs/features/m1-workspaces-core/tasks.md` pelo utilizador; fase **Implement M1** autorizada (ondas M1-I/M1-T conforme grafo).
- 2026-04-15: **Auditoria SDD pré-M1 Implement** — brechas identificadas e fixes 1–4 aplicados: `STATE.md` sincronizado; `COOKIE_SECRET` com asserção em produção (`apps/api/src/app.ts`); lint soft-fail removido em favor de `typecheck` real; CI mínimo em `.github/workflows/ci.yml` (Postgres + migrate + typecheck + test).
- 2026-04-15: **Gate Plan (M1) concluído** — `plan.md` aprovado; ADRs `0007` e `0008` aceitos. `tasks.md` redigido (TDAD).
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
- [x] **Gate Tasks → Implement (M1):** `tasks.md` aprovado (2026-04-15).
- [x] **M1-I-009** — superfície web M1 (workspaces, contas, transferências, org).
- [x] **M1 fecho** — checklist tasks + smoke E2E M1-T-009; ADRs 0007/0008 aceitos.
- [x] **M2:** Gate **Tasks → Implement** (`tasks.md` aprovado).
- [x] **M2:** fecho de marco (checklist, ADRs 0009/0010, roadmap/spec).
- [x] **M3:** Gate **Specify** — `.specs/features/m3-import-ofx-csv/spec.md` aprovado (2026-04-15).
- [x] **M3:** Gate **Plan** — `plan.md` aprovado (2026-04-15); ADR 0011/0012 aceitos para desenvolvimento M3; C4 M3 referenciado no plano.
- [x] **M3:** Gate **Tasks** — `.specs/features/m3-import-ofx-csv/tasks.md` aprovado (2026-04-15).
- [x] **M3:** Gate **Tasks → Implement** — `tasks.md` aprovado; fase **Implement M3** autorizada (ondas M3-T/M3-I).
- [x] **M3:** Implement + checklist de fecho — API M3 concluída (2026-04-15); UI M3.1 em backlog.
- [ ] (Opcional) Job CI para `pnpm test:e2e` com Postgres + `e2e-serve.mjs` (hoje só API na pipeline).

## Brechas de auditoria pendentes (pós-fixes 1–4 + 6–7)

- [ ] **Fix 5:** tornar `PlanEntitlement` extensível (não só `maxWorkspaces`) — ADR complementar antes de M4.
- [x] **Fix 6 (2026-04-15):** ADR-0007 §4 reescrito — modo primário Serializable + retry 3× com backoff; fallback explícito `READ COMMITTED` + `SELECT … FOR UPDATE` ordenado por `accountId` ASC documentado.
- [x] **Fix 7 (2026-04-15):** `M1-I-001` e `M1-T-001` atualizados para incluir **data migration retro** (backfill `personal` para orgs sem workspace) + invariante testado.
- [ ] **Fix 8:** revisar `webhooks-stripe.ts` para `current_period_end` vindo de `sub.items.data[0]` conforme API Stripe atual.
- [ ] Decidir/ADR: IdP gerenciado, modelo de preço, residência de dados, política LLM operacional.
- [ ] Alinhar `PRD.md` do root com `.specs/features/product-v1/spec.md` (ou remover PRD do root).

## Integrações

- Linear: não configurado nesta sessão; hooks Pre/Post-Linear ignorados.
