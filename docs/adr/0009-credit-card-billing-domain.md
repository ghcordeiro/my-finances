# ADR-0009: Domínio — cartão de crédito, faturas, parcelas e ajustes (M2)

## Status

**Aceito — M2 concluído (2026-04-15).** Implementação API + motor de faturas entregue; extensão `StatementStatus.scheduled` para projeção de parcelas (ver `STATE.md`). Itens opcionais do `tasks.md` M2 (UI web dedicada, E2E smoke, teste de concorrência explícito) ficam como **M2.1** se forem retomados.

## Contexto

M2 ([`.specs/features/m2-cards-billing/spec.md`](../../.specs/features/m2-cards-billing/spec.md)) exige cartões por workspace, ciclos/faturas, compras à vista e parceladas, antecipação, estornos e cashbacks, com limite **comprometido** derivado e isolamento org + workspace. M1 já define `Workspace`, `Account`, `Transfer` e padrões de arquivo e transação ([ADR-0007](0007-workspace-ledger-domain.md)).

## Decisão

### 1. Entidades Prisma (nomes)

- **`CreditCard`**: `id`, `organizationId`, `workspaceId`, `name`, `currency` (default `BRL`, alinhado a contas M1), `creditLimit` (Decimal ≥ 0), `closingDay` (1–31), `dueDay` (1–31), `timezone` (string IANA, ver §2), `archivedAt` nullable, timestamps. FK `workspaceId` → `Workspace`; redundância `organizationId` para filtros e invariantes como em `Account`.

- **`CreditCardStatement`**: `id`, `organizationId`, `creditCardId`, `periodStart`, `periodEnd` (instantes UTC), `dueAt` (instante UTC), `status` enum `open` \| `closed` \| `paid`, `closedAt` nullable, `paidAt` nullable, `createdAt`. No máximo **uma** linha `open` por `creditCardId` não arquivado.

- **`InstallmentPlan`**: `id`, `organizationId`, `creditCardId`, `purchaseAmount` (Decimal), `installmentCount` (Int ≥ 1), `purchasedAt` (DateTime UTC), `merchantDescription` opcional, `createdAt`. Representa a compra parcelada como um plano; linhas individuais referenciam-no.

- **`CreditCardStatementLine`**: `id`, `organizationId`, `statementId`, `lineKind` enum `purchase` \| `installment` \| `credit` \| `adjustment`, `amount` (**Decimal assinado:** positivo aumenta dívida do titular no extrato da fatura; negativo representa crédito/estorno/abatimento), `postedAt`, `memo` opcional, `installmentPlanId` nullable, `installmentIndex` nullable (1…N quando parcela), `referencesLineId` nullable (estorno/crédito ligado a linha de compra), `metadata` Json opcional (auditoria de antecipação). Índices `(statementId)`, `(installmentPlanId)`.

**Regra:** linhas de fatura `open` são mutáveis (novas compras à vista, parcela 1 de novo plano); faturas `closed` e `paid` não recebem novas linhas exceto via fluxos explícitos de **ajuste** (M2 fase 2) ou antecipação modelada como linhas `adjustment` + recálculo de linhas futuras — ver §5.

### 2. Timezone e dias 29–31

- **Timezone:** cada cartão tem `timezone` (IANA). Default da aplicação: `America/Sao_Paulo` se omitido na criação. Cálculo de instantes de fechamento/vencimento converte **data civil** no TZ do cartão para **UTC** armazenado.

- **Dia 29–31:** quando o mês não tem o dia configurado, usar o **último dia civil do mês** nesse timezone (*clamp*), ex.: fechamento dia 31 → 28/02 em anos não bissextos.

### 3. Fechamento de ciclo e materialização de faturas

- Função de domínio **`ensureStatementsCurrent(cardId, asOf)`** (idempotente): avança ciclos até que a fatura `open` cubra o instante `asOf` conforme regra de `closingDay`/`dueDay`. Deve ser invocada no início de operações que dependem do ciclo corrente (`GET` fatura atual, `POST` compra, listagens que expõem totais).

- **Sem cron obrigatório no M2:** fechamento **lazy** alinhado a uso da API; cron pode ser ADR futuro para notificações.

- Transição `open` → `closed`: ao abrir o **próximo** ciclo, a fatura anterior passa a `closed`; `dueAt` calculado a partir de `dueDay` relativo ao fechamento (detalhe no serviço + testes de caixa).

### 4. Alocação de parcelas (M2-RF-TXN-02)

- **Parcela 1** cai na primeira fatura (por ordem de `periodEnd`) cujo **fechamento** é **≥** `purchasedAt` arredondado à **data civil** no TZ do cartão (comparação definida no código e testada).

- **Parcela k** (k = 2…N): na fatura do **(k−1)-ésimo** fechamento mensal **subsequente** ao da parcela 1 na linha temporal do cartão (fechamentos derivados só de `closingDay` + TZ, não editáveis no M2 após existirem linhas pendentes — edição de dias fica fora do M2 mínimo).

- **Arredondamento:** dividir `purchaseAmount` em N parcelas: primeiras N−1 com `floor(amount/N, 2)` em escala monetária; última parcela recebe **remanescente** para a soma exata = `purchaseAmount` (**M2-CA-02**).

### 5. Limite comprometido (M2-RF-CRD-03)

- **Comprometido** = soma algébrica dos `amount` das linhas que **consumem limite** (tipicamente `purchase` e `installment` com amount > 0 nas faturas `open` e parcelas futuras em `closed` não `paid`), **menos** o efeito liberador de créditos (`credit` / `adjustment` negativos) conforme implementação única no serviço `availableCredit` + testes M2-CA-02/04/05.

- **Limite disponível** = `creditLimit - comprometido` (mínimo 0 na exposição API); ultrapassar ao criar compra → **409** `credit_limit_exceeded`.

### 6. Antecipação (M2-RF-TXN-04)

- **M2 mínimo:** antecipação **integral** das próximas **K** parcelas consecutivas a partir da **menor** `installmentIndex` ainda não liquidada no plano (K ≥ 1), numa única operação transacional: remove ou zera linhas futuras afetadas, regista linha(s) `adjustment` com referência ao `installmentPlanId`, recalcula totais; **auditável** via `AuditLog` + metadata.

- Antecipação parcial arbitrária ou subconjunto não consecutivo: **fora do M2 mínimo** (extensão documentada em spec *fora de escopo* implícito ou M2.1).

### 7. Estorno e cashback (M2-RF-ADJ)

- **Estorno** referenciado: linha `credit` (ou `adjustment` com efeito de crédito) com `referencesLineId`; reduz saldo da fatura onde a linha referenciada reside (se `closed`, abate total a pagar; se `open`, reduz acumulado). Estorno parcial permitido se valor ≤ saldo remanescente da linha referenciada (regra no serviço).

- **Cashback** genérico: linha `credit` na fatura `open` atual; se não houver `open`, na próxima fatura criada pelo `ensure` (edge case raro).

### 8. Pagar fatura (M2-RF-CYC-03)

- **M2:** `PATCH` de fatura para `status: paid` **sem** obrigatoriedade de `Transfer` M1. Campo opcional `paidFromAccountId` **reservado** para extensão futura (não obrigatório no M2).

### 9. Concorrência

- Escritas que alteram a mesma fatura `open` ou o mesmo `installmentPlan` usam **`prisma.$transaction` com `isolationLevel: 'Serializable'`** e **retry** até 3× com backoff curto em `P2034`, alinhado ao modo primário do ADR-0007.

### 10. Arquivamento e workspace

- **Cartão arquivado:** proibir novas compras, antecipações e novos planos; leituras permitidas.

- **Workspace arquivado (M1):** proibir mutações M2 no workspace (alinhado a bloqueio de novas contas/transferências).

## Consequências

**Positivas:** modelo normalizado; parcelas como linhas rastreáveis; projeção de caixa consultável por SQL; coerência com padrões M1.

**Negativas:** `ensureStatementsCurrent` deve ser cuidadosamente testado (bordas de mês, TZ); volume alto de linhas pode exigir agregações materializadas em marco futuro.

**Alternativas rejeitadas:** apenas event sourcing sem snapshot de fatura (complexidade para MVP); múltiplas tabelas por tipo de linha (join mais pesado sem ganho claro no M2).
