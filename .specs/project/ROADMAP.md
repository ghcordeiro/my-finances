# ROADMAP — My Finances

Ordem sugerida para reduzir risco. Cada fase pode virar feature SDD (`spec` → `plan` → `tasks` → `implement`).

## M0 — Plataforma SaaS (fundação obrigatória) — **concluído (2026-04-15)**

- **Inquilino (tenant/organização):** modelo de dados, criação no onboarding, limites de plano.
- **Identidade:** cadastro, login, recuperação de senha, sessão ou tokens; verificação de e-mail mínima.
- **Autorização:** papéis (ex.: owner, member, accountant read-only) com escopo por organização e por workspace quando aplicável.
- **Faturação (mínimo):** integração preparada ou stub com um provedor (ex.: Stripe): plano, status de assinatura, webhooks; **entitlements** (limites de workspaces, armazenamento, IA).
- **Observabilidade e auditoria:** logs estruturados, trilha de auditoria para ações sensíveis (export, convite, mudança de plano).
- **Infra:** ambientes, migrações de banco, armazenamento de anexos com prefixo/isolamento por tenant.

*Sem M0 estável, M1+ não é SaaS de verdade — apenas app.*

**Nota de fechamento:** recuperação de senha e verificação de e-mail obrigatória ficam para incremento posterior (ver `STATE.md`). O roadmap textual acima permanece como visão de produto; o rastreio fino está em `tasks.md` + código.

## M1 — Workspaces e núcleo financeiro — **concluído (2026-04-15)**

- **Workspaces** (PF / PJ) **dentro do tenant**, com isolamento lógico entre workspaces.
- Contas correntes e investimentos; transferências internas e PF ↔ PJ quando permitido pela regra de negócio.
- **UI:** fluxos e hierarquia alinhados ao pacote Stitch em `docs/design/stitch-reference/` (ver `manifest.json` e spec M1).

**Nota de fechamento:** entregáveis e rastreio fino em `.specs/features/m1-workspaces-core/tasks.md` + ADRs `0007`/`0008` (aceitos). E2E web: `apps/web/e2e/onboarding.spec.ts` (incl. smoke M1-T-009); API/UI de teste sob portas **3109 / 5188** (`E2E_API_PORT` / `E2E_WEB_PORT`). CI continua a correr apenas API (`pnpm test`); E2E local: `pnpm exec playwright install` (primeira vez) e `pnpm test:e2e` com Postgres de teste disponível.

## M2 — Cartões e motor de faturas — **concluído (2026-04-15)**

- Cartões por workspace; ciclos; parcelas projetadas; antecipação; estornos/cashbacks.
- **Spec / Plan / Tasks:** [`m2-cards-billing/`](../features/m2-cards-billing/) · ADRs `0009`, `0010` · C4 `docs/architecture/c4-m2-cards-billing.md` — **fecho de marco**; backlog opcional **M2.1** (UI/E2E/concorrência) em `tasks.md`.

## M3 — Importação OFX/CSV — **concluído (API, 2026-04-15)**

- Upload (objeto storage por tenant), templates CSV, deduplicação.
- **Spec / Plan / Tasks:** [`m3-import-ofx-csv/`](../features/m3-import-ofx-csv/) — fecho de marco API; ADR [0011](../../docs/adr/0011-import-ofx-csv-domain.md), [0012](../../docs/adr/0012-api-import-ofx-csv-scoping.md) · C4 [`c4-m3-import-ofx-csv.md`](../../docs/architecture/c4-m3-import-ofx-csv.md). **Backlog M3.1:** UI `/app/.../imports` + E2E (ver `tasks.md`).

## M4 — Categorização e regras

- Categorias, tags, regras; IA com políticas por tenant (incl. desligar nuvem / BYOK conforme spec).

## M5 — Dashboard e orçamento

- Visão consolidada, drill-down, alertas.

## M6 — Conciliação e auditoria

- Saldo OFX vs. calculado; alertas de furo.

## M7 — Anexos e contabilidade

- Anexos em storage isolado; export PJ; convite contador (read-only) com **auditoria**.

## M8 — API pública e extensibilidade

- API keys por tenant (ou por workspace), rate limit, documentação; preparação para webhooks.

---

**Próximo passo SDD recomendado:** **M4 — Categorização e regras** — especificar em `.specs/features/` (ou alinhar backlog M3.1 se prioridade for UI de imports).
