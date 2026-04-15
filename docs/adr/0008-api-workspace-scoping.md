# ADR-0008: Escopo de workspace na API REST (M1)

## Status

Proposto — 2026-04-15 (Plan M1)

## Contexto

ADR-0006 fixou `X-Organization-Id` para rotas de domínio. M1 exige também contexto de **workspace** para contas e listagens, mas transferências podem **atravessar** workspaces. O spec permitia cabeçalho `X-Workspace-Id` **ou** URLs aninhadas.

## Decisão

1. **Manter** `X-Organization-Id` obrigatório em todas as rotas M1 descritas abaixo (exceto as que já dispensam org no M0, ex.: `GET /v1/organizations`).

2. **Workspaces (CRUD):** prefixo **`/v1/workspaces`** com apenas contexto de organização no header — sem `X-Workspace-Id`.
   - `GET /v1/workspaces` — listar da org.
   - `POST /v1/workspaces` — criar (body: `name`, `kind`).
   - `PATCH /v1/workspaces/:workspaceId` — renomear / arquivar.

3. **Contas:** recurso aninhado ao workspace (URL carrega o id; fácil de logar e testar):
   - `GET /v1/workspaces/:workspaceId/accounts`
   - `POST /v1/workspaces/:workspaceId/accounts`
   - `PATCH /v1/workspaces/:workspaceId/accounts/:accountId` (arquivar / renomear se permitido no spec)

4. **Transferências:**
   - `POST /v1/transfers` — contexto **somente** org no header; corpo JSON com `fromAccountId`, `toAccountId`, `amount`, `currency`, `bookedAt`, `memo?`. O servidor valida contas, moedas, arquivo e regras PF↔PJ.
   - `GET /v1/workspaces/:workspaceId/transfers` — lista transferências em que **origem ou destino** está em conta cujo `workspaceId` é o da URL (visão M1-RF-TFR-05).

5. **Respostas HTTP — workspace inexistente na org:** **404** com payload JSON genérico (`error: "workspace_not_found"`) para não vazar existência de ids de outras organizações ao mesmo tempo que simplifica cliente.

6. **Limite de workspaces (`maxWorkspaces`):** em `POST /v1/workspaces`, quando o count de workspaces **não arquivados** ≥ limite do plano, responder **409** com `{ "error": "workspace_limit_exceeded", "message": "…" }` (alinhado a M1-RF-WSP-04). *Nota:* o probe M0 `billing/entitlement-probe` pode permanecer 403; apenas criação de workspace adota 409.

7. **SPA / logs:** o cliente envia sempre `X-Organization-Id`; o `workspaceId` ativo aparece na URL de contas/transferências listadas, reduzindo ambiguidade em suporte e APM.

## Consequências

**Positivas:** coerência com ADR-0006; rotas REST legíveis; transferências cross-workspace sem header artificial.

**Negativas:** duas formas de endereçar workspace (path em contas vs path em list transfer) — documentado em OpenAPI/README interno.

**Alternativa rejeitada:** somente `X-Workspace-Id` global (fácil omitir em uma rota e gerar bugs).
