# ADR-0012: API REST — importação OFX/CSV e templates (M3)

## Status

**Aceito — M3 concluído (2026-04-15).** Rotas `/v1/workspaces/:workspaceId/imports` e `csv-templates` expõem os códigos de erro deste ADR; alterações de contrato via revisão deste ADR ou novo ADR.

## Contexto

M1 fixou `X-Organization-Id` e URLs com `workspaceId` para contas ([ADR-0008](0008-api-workspace-scoping.md)). M3 acrescenta uploads e templates sem quebrar o padrão de escopo. O spec exige erros JSON estáveis (M3-RNF-03).

## Decisão

### 1. Cabeçalhos e contexto

- Manter **`X-Organization-Id`** obrigatório em todas as rotas abaixo.
- **`workspaceId`** sempre no path (`/v1/workspaces/:workspaceId/...`), resolvido com o mesmo helper que contas (`loadWorkspaceInOrg`); 404 `workspace_not_found`.

### 2. Rotas — importação

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/v1/workspaces/:workspaceId/imports` | Multipart: `file`, `accountId` (UUID da conta no workspace), opcional `templateId` (obrigatório se `file` for `.csv`). Cria batch, upload storage, processa síncrono, devolve batch + resumo. |
| `GET` | `/v1/workspaces/:workspaceId/imports` | Lista batches (paginação cursor ou offset — alinhar ao padrão M2). |
| `GET` | `/v1/workspaces/:workspaceId/imports/:importId` | Detalhe + `resultSummary`. |

**Não** expor `organizationId`/`workspaceId` no multipart para autorização — apenas `accountId` / `templateId` como dados, sempre validados contra o workspace do path.

### 3. Rotas — templates CSV

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/v1/workspaces/:workspaceId/csv-templates` | Lista templates **do workspace** + templates **org-wide** (`workspaceId` null), com filtro opcional `?scope=workspace|organization|all` (default `all`). |
| `POST` | `/v1/workspaces/:workspaceId/csv-templates` | Cria template; body inclui `name`, `columnMap`, …; `scope`: `workspace` (default) grava `workspaceId` do path; `organization` grava `workspaceId=null` (apenas `owner` ou política em Tasks). |
| `PATCH` | `/v1/workspaces/:workspaceId/csv-templates/:templateId` | Atualiza; validar que template pertence à org e, se scoped workspace, ao mesmo workspace. |
| `DELETE` | `/v1/workspaces/:workspaceId/csv-templates/:templateId` | Remove; 404 se fora de escopo. |

### 4. Códigos de erro HTTP (payload `{ "error": "<code>", ... }`)

| HTTP | Código | Quando |
|------|--------|--------|
| 400 | `invalid_file` | Extensão/MIME/conteúdo não parseável, OFX sem transações esperadas |
| 400 | `invalid_multipart` | Campos obrigatórios em falta |
| 404 | `account_not_found` | Conta não existe ou não pertence ao workspace |
| 404 | `template_not_found` | UUID inválido ou template noutra org/workspace |
| 409 | `duplicate_import` | Mesmo `contentSha256` + workspace + conta já importado com sucesso/parcial |
| 409 | `template_name_conflict` | Violação de unicidade de nome |
| 422 | `import_too_many_lines` | Acima do limite do plano (10k linhas) |
| 422 | `csv_template_required` | CSV sem `templateId` |
| 413 | `file_too_large` | Acima de 10 MiB (se o servidor não truncar antes) |

Respostas **403** seguem política existente (membership, entitlements). Cross-org: 404 em ids ou 403 conforme padrão já usado em `tenant-isolation`.

### 5. Auditoria

- `appendAudit` em: `import_batch_created`, `import_batch_completed` / `failed`; `csv_template_created` / `updated` / `deleted`.
- `resourceType` sugeridos: `import_batch`, `csv_import_template`; `resourceId` = UUID.

## Consequências

**Positivas:** simetria com ADR-0008/0010; cliente previsível.

**Negativas:** `POST` síncrono pode demorar — mitigado por limite de linhas e timeout de proxy documentado em Tasks.
