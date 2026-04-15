# M2 — Cartões e motor de faturas

Especificação do **marco M2** do `ROADMAP.md`. Refina e torna verificáveis os requisitos globais **RF-CCR-01…05** de `.specs/features/product-v1/spec.md`, assumindo **M0 e M1 concluídos** (organização, sessão, `X-Organization-Id`, `X-Workspace-Id`, workspaces, contas correntes/investimento, transferências, auditoria append).

## System Process Context

Dentro de um **workspace** já isolado por organização, o utilizador gere **cartões de crédito** (ou equivalente “compra agora, paga depois” modelado como cartão) e o sistema mantém um **motor de faturas**: ciclos com data de fechamento e vencimento, fatura **aberta** (acumulando compras do período), fechamento que gera fatura **fechada** com total a pagar, e **parcelamentos** que projetam parcelas futuras nas faturas corretas. **Antecipação** de parcelas altera o plano de pagamentos e o **limite disponível** de forma coerente. **Estornos** e **cashbacks** entram como **créditos** que reduzem dívida de fatura ou anulam/reverem uma transação referenciada, sem quebrar o rastreio do plano de parcelas original quando aplicável.

**Atores:** utilizador com `Membership` ativo (papéis M0). **Sistemas:** API REST `/v1`, PostgreSQL, motor de domínio de faturas (módulo com fronteira clara — **RNF-ARC-01** / Constituição §3).

**Pré-condições:** sessão válida; `X-Organization-Id`; para operações de domínio M2, **`X-Workspace-Id`** (ou recurso aninhado inequívoco, coerente com ADR-0008) identificando o workspace do cartão/fatura.

## User stories (M2)

1. Como titular, quero **cadastrar um cartão no workspace** com nome, limite total, dia de fechamento e dia de vencimento, para acompanhar gastos e faturas desse workspace.
2. Como titular, quero ver **limite disponível** derivado do limite total menos utilização comprometida (compras à vista no ciclo atual + parcelas futuras já projetadas), para não ultrapassar o limite contratual modelado.
3. Como titular, quero que o sistema **abra e feche faturas automaticamente** conforme o calendário do cartão, para não ter de fechar manualmente cada ciclo.
4. Como titular, quero **registar uma compra à vista** na fatura aberta do ciclo corrente, para refletir gasto imediato no fechamento atual.
5. Como titular, quero **registar uma compra parcelada** (ex.: 12x) e ver as parcelas **1/12 … 12/12** distribuídas nas faturas futuras corretas, para projeção de caixa alinhada ao PRD (**CA-03**).
6. Como titular, quero **antecipar parcelas** (integral ou parcialmente, conforme o plano permitir) com recálculo coerente do limite disponível, para liquidar antes do vencimento.
7. Como titular, quero **registar estorno ou cashback** como crédito ligado a uma compra ou como crédito genérico no cartão, para abater dívida ou anular impacto da transação original.

## Requisitos funcionais (IDs — M2)

### M2-RF-CRD — Cartões

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M2-RF-CRD-01 | CRUD lógico de **cartão** por workspace: criar, editar metadados (nome, dias de fechamento/vencimento, limite total), arquivar (soft); todo cartão tem `organization_id` e `workspace_id`. | RF-CCR-01 + M1-RF-WSP-05 |
| M2-RF-CRD-02 | Campos mínimos: **nome** (apelido), **limite total** (decimal ≥ 0, moeda do workspace ou default BRL alinhado a contas M1), **dia de fechamento** (1–31) e **dia de vencimento** (1–31), com validação de combinações impossíveis no Plan (ex.: 31 em meses curtos — regra de “último dia útil” fica em gray area). | RF-CCR-01 |
| M2-RF-CRD-03 | **Limite disponível** é valor derivado exposto na API (leitura): `limite total - comprometido`, onde *comprometido* inclui compras já lançadas no ciclo aberto que consumem limite + soma das parcelas futuras ainda não liquidadas do plano ativo (definição exata de bordas no Plan). | RF-CCR-01 + RF-CCR-04 |
| M2-RF-CRD-04 | Listagem e operações por `id` validam pertença ao workspace/org do contexto; mesmo padrão de isolamento que M1 (**M1-CA-01/02**). | RF-PLT-01 |

### M2-RF-CYC — Ciclos e faturas

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M2-RF-CYC-01 | Para cada cartão ativo existe uma sequência de **ciclos**; em cada instante há no máximo uma fatura **aberta** (acumulando compras do período corrente) por cartão, salvo decisão explícita no Plan para casos de troca de cartão/reemissão. | RF-CCR-02 |
| M2-RF-CYC-02 | **Abertura/fechamento automático:** ao atingir a data de fechamento (conforme timezone acordado no Plan), o ciclo fecha: total da fatura consolidado; abre-se novo ciclo com nova fatura aberta. | RF-CCR-02 |
| M2-RF-CYC-03 | Faturas **fechadas** mantêm estado de pagamento distinto (ex.: `open` para aguardar pagamento até `dueDate`, `paid`, `overdue` se aplicável); a transição exata e integração com **conta corrente** para “pagar fatura” pode ser M2 mínimo (marcação manual de pago) ou M2+ — ver gray areas. | RF-CCR-02 |
| M2-RF-CYC-04 | API de leitura: listar faturas por cartão (filtros por estado/data); detalhe de fatura com linhas (itens). | RF-CCR-02 |

### M2-RF-TXN — Lançamentos, parcelas e antecipação

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M2-RF-TXN-01 | **Compra à vista:** cria linha na fatura aberta do ciclo corrente; valor conta para total do fechamento e para comprometimento de limite até liquidação/pagamento conforme modelo. | RF-CCR-02 |
| M2-RF-TXN-02 | **Compra parcelada:** cria plano com N parcelas; cada parcela k/N é **projetada** na fatura cujo período de competência/corte acomoda a data acordada da parcela k (regra de mapeamento data compra → fatura no Plan). | RF-CCR-03 |
| M2-RF-TXN-03 | Parcelas futuras são **visíveis** antes do fechamento do ciclo em que cairão (projeção); alteração do plano de fechamento do cartão não apaga histórico — migração de parcelas pendentes é requisito do Plan se suportar edição de dias. | RF-CCR-03 |
| M2-RF-TXN-04 | **Antecipação:** operação explícita que reduz parcelas futuras e recalcula **limite disponível** e totais de faturas afetadas de forma **auditável** (evento ou linhas de ajuste). | RF-CCR-04 |

### M2-RF-ADJ — Estornos e cashbacks

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M2-RF-ADJ-01 | **Estorno** referenciado a uma linha de compra existente: gera crédito que reduz o saldo da fatura relevante ou estorna a linha conforme modelo (total ou parcial); não deve duplicar efeito em limite. | RF-CCR-05 |
| M2-RF-ADJ-02 | **Cashback** (genérico ou ligado a campanha): registo como crédito no cartão que **abate** dívida da fatura aberta ou da próxima fechada, conforme regra no Plan. | RF-CCR-05 |
| M2-RF-ADJ-03 | Trilha de auditoria para criação/edição de cartão, fechamento de ciclo, compras, antecipação, estorno e cashback (**extensão M1-RF-AUD-01** com `resourceType` adequados). | RF-PLT-06 |

## Requisitos não funcionais (M2)

| ID | Requisito |
|----|-----------|
| M2-RNF-01 | Isolamento **org + workspace** em todas as queries e comandos; testes automatizados espelhando padrão M1 (`tenant-isolation`). |
| M2-RNF-02 | Motor de faturas/parcelas em **módulo de domínio** testável sem acoplar à UI; API apenas DTOs/contratos estáveis. |
| M2-RNF-03 | Operações que alteram totais de fatura ou limite em concorrência usam estratégia documentada no Plan (transação serializável / retry alinhado a ADR-0007 ou equivalente para agregados de cartão). |
| M2-RNF-04 | Erros 4xx com payload JSON estável (códigos de negócio para limite excedido, fatura fechada imutável, parcela inválida, etc.). |

## Critérios de aceite (M2)

- **M2-CA-01:** Cartões criados no workspace W1 não aparecem em listagens com contexto W2 (mesma org).
- **M2-CA-02:** Compra 12x gera 12 parcelas visíveis com índice 1…12 e valores que somam o total da compra (tolerância de arredondamento definida no Plan).
- **M2-CA-03:** Após fechamento de ciclo simulado (ou data de teste injetável), compras do período aparecem na fatura fechada e nova fatura aberta inicia vazia para novas compras à vista.
- **M2-CA-04:** Antecipação de parcelas reduz o número ou valor das parcelas futuras e atualiza limite disponível de forma coerente (teste de propriedade ou cenário fixo no Plan).
- **M2-CA-05:** Estorno parcial referenciado reduz saldo devido sem inflar limite disponível indevidamente.
- **M2-CA-06:** Utilizador de outra organização não acede a cartão/fatura por ID (403 ou 404 alinhado ao padrão M0/M1).

## Referência de UI (Stitch / design)

O `manifest.json` atual do Stitch **não** inclui telas dedicadas a cartões/faturas. A superfície web M2 deve seguir **RNF-UI-01**: tokens (`stitch-tokens.css`, `mf-layout.css`) e `DESIGN-SYSTEM.md`. Quando o export Stitch ganhar telas de cartão/fatura, este spec deve ser atualizado com a tabela de mapeamento (como em M1).

## Fora de escopo (M2 — explícito)

- Importação OFX/CSV de fatura do banco (**M3**); M2 assume **lançamentos manuais ou API interna** criados pelo utilizador.
- Categorias, tags, regras, IA (**M4**).
- Dashboard consolidado PF+PJ (**RF-DSH**, **M5**).
- Pagamento automático com débito em **conta corrente** via `Transfer` M1: **opcional** neste marco — se não entrar em M2, “marcar fatura como paga” permanece manual.
- Múltiplas moedas com conversão cambial além de uma moeda por cartão alinhada ao workspace.
- Cartões corporativos com sub-portadores, dependentes ou limites por categoria.

## Contrato de contexto (API)

- Mantêm-se `X-Organization-Id` e **`X-Workspace-Id`** para rotas de domínio M2, salvo recursos aninhados `/v1/.../workspaces/:workspaceId/...` já preferidos — alinhar ao ADR-0008 na implementação.

## Gray areas — **resolvidos no Plan** (2026-04-15)

Ver tabela *Decisões dos gray areas* em [`plan.md`](./plan.md) e ADRs **0009** / **0010**.

---

**Specify (M2):** **aprovado** (2026-04-15).  
**Plan (M2):** [`plan.md`](./plan.md); ADRs [`0009`](../../../docs/adr/0009-credit-card-billing-domain.md), [`0010`](../../../docs/adr/0010-api-credit-card-scoping.md); C4 [`c4-m2-cards-billing.md`](../../../docs/architecture/c4-m2-cards-billing.md).  
**Implement / fecho:** **concluído (2026-04-15)** — ver [`tasks.md`](./tasks.md) checklist e `STATE.md`. **Próximo marco:** [M3 — importação OFX/CSV](../m3-import-ofx-csv/spec.md).
