# Plan — M2 (cartões e motor de faturas)

## Objetivo deste plano

Definir arquitetura e componentes para o **marco M2** em `.specs/features/m2-cards-billing/spec.md`: cartões por workspace, faturas com ciclos, compras à vista e parceladas, antecipação (subconjunto mínimo), estornos/cashbacks, limite comprometido derivado, auditoria e API REST coerente com M1.

## Escopo M2

| Incluído | Excluído (fases posteriores) |
|----------|------------------------------|
| Modelo `CreditCard`, `CreditCardStatement`, `CreditCardStatementLine`, `InstallmentPlan` + migração Prisma | Importação OFX de fatura (**M3**) |
| Motor `ensureStatementsCurrent` + regras de parcelas (ADR-0009) | Edição de `closingDay`/`dueDay` com migração de parcelas pendentes |
| Rotas REST (ADR-0010) | Pagamento obrigatório via `Transfer` M1 |
| Antecipação: **K parcelas consecutivas** a partir da próxima pendente | Antecipação parcial arbitrária / subconjunto não consecutivo |
| Marcar fatura como `paid` (manual) | Cron obrigatório de fechamento (lazy + opcional futuro) |
| Testes Vitest M2-CA-01…06 + isolamento | Categorização, dashboard consolidado |

## Decisões dos gray areas (spec → Plan)

| # | Decisão |
|---|---------|
| 1 | **Timezone:** IANA por cartão; default `America/Sao_Paulo`; instantes persistidos em UTC. |
| 2 | **Pagar fatura:** apenas `PATCH` para `paid` no M2; `paidFromAccountId` reservado, sem `Transfer` obrigatório. |
| 3 | **Dia 29–31:** *clamp* ao último dia do mês no TZ do cartão. |
| 4 | **Antecipação:** somente liquidação das próximas **K** parcelas **consecutivas** (integral dessas parcelas). |
| 5 | **Modelo de dados:** tabela única de linhas com `lineKind` + `InstallmentPlan` separado (ADR-0009). |

## Rastreio spec → entregáveis

| Requisito / CA | Entregável técnico |
|----------------|-------------------|
| M2-RF-CRD-* | Serviço `credit-cards.ts`, rotas `.../cards`, cálculo `availableCredit` |
| M2-RF-CYC-* | Serviço `billing-cycle.ts` (ou `statements.ts`), `ensureStatementsCurrent`, enums de status |
| M2-RF-TXN-* | `POST .../purchases`, projeção de linhas + `InstallmentPlan`, arredondamento |
| M2-RF-TXN-04 / M2-CA-04 | `POST .../anticipate` + testes de limite e linhas |
| M2-RF-ADJ-* | `POST .../credits` + regras de `referencesLineId` |
| M2-RF-ADJ-03 | `appendAudit` com novos `resourceType` / ações |
| M2-CA-01, M2-CA-06 | Testes isolamento workspace + cross-org |
| M2-CA-02, M2-CA-03, M2-CA-05 | Testes de domínio parcelas, fechamento, estorno |
| M2-RNF-03 | Transações serializáveis + retry em escritas concorrentes no mesmo cartão/fatura |

## Componentes lógicos

1. **Pre-handlers** — reutilizar `requireAuth` + `requireOrgContext`; helper **`loadWorkspaceInOrg`** (M1) para `workspaceId` no path; 404 `workspace_not_found`.

2. **Serviço Billing cycle** — cálculo de períodos, `dueAt`, transições `open`/`closed`, idempotência.

3. **Serviço Credit cards** — CRUD cartão; validação arquivo; orquestra `ensure` antes de leituras críticas.

4. **Serviço Purchases / Installments** — criar compra, plano, linhas em statements; validar limite.

5. **Serviço Credits / Anticipation** — estorno, cashback, antecipação conforme ADR-0009.

6. **Web App (fase UI)** — páginas sob `/app/workspaces/:id/cards` (lista, detalhe, fatura atual, form compra); tokens Stitch / `DESIGN-SYSTEM.md` até haver telas dedicadas no export.

## Modelo de dados (resumo)

Ver **ADR-0009**. FKs com `onDelete: Restrict` onde arquivo não apaga histórico; índices `(workspace_id)` em cartões, `(credit_card_id, status)` em statements, `(statement_id)` em linhas.

## Segurança

- Todas as queries filtram por `organizationId` do request e por `workspaceId` resolvido no path.
- Nunca confiar em `organizationId` / `workspaceId` do body para autorização de recurso — derivar do path + membership.

## Observabilidade

- Logs estruturados com `workspaceId`, `creditCardId`, `statementId` quando aplicável.

## Brownfield

Rotas e padrões em `apps/api` (Fastify, Prisma, testes como `tenant-isolation.test.ts`). Reutilizar helpers de UUID e formato de erro JSON do M0/M1.

## UI (M2)

Sem telas Stitch listadas no `manifest.json` atual: seguir **RNF-UI-01**; quando existirem telas de cartão/fatura no Stitch, atualizar `spec.md` com tabela de mapeamento.

## Diagramas C4

- **L1 + L2:** [`docs/architecture/c4-m2-cards-billing.md`](../../../docs/architecture/c4-m2-cards-billing.md)

> **Validação spec-driven (C4):** níveis **L1 + L2** (padrão médio/grande). Sequência opcional adiada a Tasks se útil para E2E.

## ADRs desta fase

| ADR | Tema |
|-----|------|
| [0009](../../../docs/adr/0009-credit-card-billing-domain.md) | Entidades, TZ, fechamento lazy, parcelas, limite, antecipação, estorno, concorrência |
| [0010](../../../docs/adr/0010-api-credit-card-scoping.md) | Rotas `/v1/workspaces/:id/cards/...`, erros, auditoria |

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Bugs em datas (TZ / fevereiro) | Bateria de testes unitários no motor de calendário; propriedades em datas limítrofes |
| Drift limite vs. linhas | Uma função `getCommittedAmount` testada; 409 centralizado |
| Concorrência em `open` statement | Serializable + retry (ADR-0009 §9) |

---

**Plan (M2):** **aprovado (2026-04-15)**. **Tasks:** [`tasks.md`](./tasks.md) — gate **Tasks → Implement** e **fecho do marco M2** concluídos (2026-04-15). **M3:** [spec importação](../m3-import-ofx-csv/spec.md).
