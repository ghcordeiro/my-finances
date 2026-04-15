# ADR-0010: API REST — cartões e faturas sob workspace (M2)

## Status

**Aceito — M2 concluído (2026-04-15).** Rotas `/v1/workspaces/:workspaceId/cards/...` implementadas conforme este ADR; códigos de erro estáveis alinhados.

## Contexto

ADR-0006 fixou `X-Organization-Id`; ADR-0008 fixou aninhamento `/v1/workspaces/:workspaceId/...` para contas e listagem de transferências. M2 adiciona cartões e faturas **sempre** no âmbito de um workspace.

## Decisão

1. **Cabeçalhos:** manter `X-Organization-Id` obrigatório. **Não** exigir `X-Workspace-Id` global para estes recursos: o `workspaceId` vem sempre do **path**, como em contas M1.

2. **Cartões:**
   - `GET /v1/workspaces/:workspaceId/cards` — listar cartões não arquivados (ou query `?includeArchived=true`).
   - `POST /v1/workspaces/:workspaceId/cards` — criar (body: `name`, `creditLimit`, `currency?`, `closingDay`, `dueDay`, `timezone?`).
   - `PATCH /v1/workspaces/:workspaceId/cards/:cardId` — editar metadados / arquivar.

3. **Faturas (statements):**
   - `GET /v1/workspaces/:workspaceId/cards/:cardId/statements` — lista com filtros opcionais `status`, `from`, `to`.
   - `GET /v1/workspaces/:workspaceId/cards/:cardId/statements/current` — atalho para fatura `open` (404 se cartão inválido/arquivado sem ciclo — edge na primeira criação resolvido por `ensure` na criação do cartão).
   - `GET /v1/workspaces/:workspaceId/cards/:cardId/statements/:statementId` — detalhe com linhas.

4. **Compras e operações:**
   - `POST /v1/workspaces/:workspaceId/cards/:cardId/purchases` — body: `amount`, `purchasedAt`, `installmentCount` (≥ 1), `memo?`, `merchant?`. Servidor chama `ensureStatementsCurrent`, valida limite, cria linha(s) e `InstallmentPlan` se N > 1.
   - `POST /v1/workspaces/:workspaceId/cards/:cardId/installment-plans/:planId/anticipate` — body: `installmentCount` (número de parcelas consecutivas a partir da próxima pendente), conforme ADR-0009 §6.
   - `POST /v1/workspaces/:workspaceId/cards/:cardId/credits` — body: `amount`, `kind: refund|cashback`, `referencesLineId?`, `memo?`, `postedAt?`.

5. **Pagar fatura:** `PATCH /v1/workspaces/:workspaceId/cards/:cardId/statements/:statementId` com body `{ "status": "paid" }` apenas a partir de `closed` (422 se `open`).

6. **Erros estáveis (exemplos):** `workspace_not_found` (404), `card_not_found` (404), `statement_not_found` (404), `credit_limit_exceeded` (409), `statement_not_mutable` (422), `installment_plan_not_found` (404), `anticipation_invalid` (422). Mensagens humanas secundárias.

7. **Auditoria:** ações `credit_card.*`, `credit_card_statement.*`, `installment_plan.*`, `credit_card_line.*` (granularidade mínima acordada na Implement) com `metadata` contendo ids M2.

## Consequências

**Positivas:** consistência com ADR-0008; URLs cacheáveis; fácil teste de isolamento por `workspaceId` no path.

**Negativas:** URLs longas; múltiplos round-trips se UI precisar muitos recursos (mitigação: agregar DTO na Implement se necessário, sem mudar convenção REST base).

**Alternativa rejeitada:** `POST /v1/cards` com `workspaceId` só no body (risco de inconsistência e bypass mental de escopo).
