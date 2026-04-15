# Plan — M1 (workspaces + contas + transferências)

## Objetivo deste plano

Definir arquitetura e componentes para o **marco M1** descrito em `.specs/features/m1-workspaces-core/spec.md`: workspaces PF/PJ sob organização, contas com saldo derivado, transferências intra e inter-workspace (PF ↔ PJ), enforcement de `maxWorkspaces`, auditoria estendida e superfície web alinhada ao **Stitch** (`docs/design/`).

## Escopo M1

| Incluído | Excluído (fases posteriores) |
|----------|------------------------------|
| Modelo `Workspace`, `Account`, `Transfer` + migração Prisma | Cartões / faturas (M2) |
| Rotas REST conforme ADR-0008 | Importação OFX/CSV (M3) |
| Cálculo de saldo atual derivado | Visão consolidada RF-WSP-02 |
| Limite de workspaces: **409** na criação (M1-RF-WSP-04) | ACL por workspace |
| Workspace `personal` default no registro de org | API keys públicas (M8) |
| Testes automatizados M1-CA-01…06 | Categorização / LLM |

## Decisões dos gray areas (spec → Plan)

| # | Decisão |
|---|---------|
| 1 | **Arquivamento:** workspace arquivado bloqueia **novas** contas e **novas** transferências envolvendo contas desse workspace; leituras mantidas. |
| 2 | **Workspace id inválido para a org:** resposta **404** `workspace_not_found` (ver ADR-0008). |
| 3 | **Saldo / concorrência:** saldo sempre **derivado**; escrita de transferência em transação **serializável** (ou equivalente documentado em ADR-0007). |
| 4 | **Onboarding:** criar **automaticamente** um workspace `personal` na transação de `registerUserAndOrg`. |

## Rastreio spec → entregáveis

| Requisito / CA | Entregável técnico |
|------------------|-------------------|
| M1-RF-WSP-01…05 | Rotas `/v1/workspaces`, validação org, soft archive, contagem para entitlement |
| M1-RF-WSP-04 / M1-CA-03 | Contar apenas workspaces `archivedAt IS NULL`; 409 `workspace_limit_exceeded` |
| M1-RF-ACC-* | Rotas aninhadas `.../workspaces/:id/accounts`, agregação `currentBalance` |
| M1-RF-TFR-* | `POST /v1/transfers`, `GET .../transfers`, validação PF↔PJ, 422 em combinação ilegal |
| M1-RF-AUD-01 | `appendAudit` com ações novas + metadata com `workspaceId` |
| M1-CA-01, M1-CA-02 | Testes Vitest: isolamento workspace + cross-org |
| M1-CA-04, M1-CA-05 | Testes de transferência intra e inter-workspace |
| Constituição §6 / spec UI | Rotas e componentes espelham telas Stitch listadas no spec |

## Componentes lógicos

1. **Plugin / pre-handlers** — `requireAuth` + `requireOrgContext`; novo helper **`loadWorkspaceInOrg(workspaceId)`** usado nas rotas aninhadas (404 se não pertencer à `request.organizationId`).
2. **Serviço Workspaces** — create (com entitlement + default já coberto no registro), list, patch archive/rename; integra contagem ativa.
3. **Serviço Accounts** — CRUD dentro do workspace; arquivamento; query de saldo derivado (raw SQL ou duas queries Prisma — detalhe na Implement).
4. **Serviço Transfers** — validação de contas, moeda, arquivo, regra PF↔PJ; transação; auditoria.
5. **Web App** — páginas ou rotas client: lista/CRUD workspaces; contas por workspace; formulário de transferência; reutilizar tokens Stitch (`docs/design/stitch-reference/`).

## Modelo de dados (resumo)

Ver **ADR-0007** para campos e enums. Relações: `Organization` 1—N `Workspace`; `Workspace` 1—N `Account`; `Transfer` N—1 `Account` (from/to) com `organizationId` redundante para queries e checagens rápidas.

**Índices sugeridos:** `(organization_id, archived_at)` em workspaces; `(workspace_id)` em accounts; `(organization_id, booked_at)` em transfers; FKs com `onDelete: Restrict` onde arquivar não apaga histórico.

## Segurança

- Todas as queries filtram por `organizationId` do request autenticado.
- Nunca confiar em `organizationId` vindo do body para transferências — derivar das contas carregadas e validar igualdade.
- Logs estruturados: incluir `workspaceId` quando aplicável (ADR-0008).

## Observabilidade

- Métricas opcionais: contagem de 409 `workspace_limit_exceeded`, 422 em transferências inválidas.

## Brownfield

Código M0 em `apps/api` (`require-org`, `org` routes, `entitlements`, `registration`). **Duplicação:** extrair validação UUID reutilizada (opcional na Implement, não bloqueia Plan).

## UI (M1)

Seguir **Stitch** conforme tabela no `spec.md` (*Referência de UI*): `gerenciar-workspaces`, `contas-do-workspace`, `transferencias-e-fluxos`, `configuracoes-da-organizacao`, login/cadastro. Comparar HTML de referência e `DESIGN-SYSTEM.md` na Implement.

## Diagramas C4

- **L1 + L2:** `docs/architecture/c4-m1-workspaces.md`

> **Validação spec-driven (C4):** padrão **L1 + L2** conforme combinado para features médias/grandes. Diagrama de sequência permanece opcional (nota no ficheiro C4).

## ADRs desta fase

| ADR | Tema |
|-----|------|
| [0007](../../../docs/adr/0007-workspace-ledger-domain.md) | Modelo workspace / conta / transferência, saldo derivado, arquivo, onboarding |
| [0008](../../../docs/adr/0008-api-workspace-scoping.md) | Rotas `/v1/workspaces`, aninhamento, `POST /v1/transfers`, 404/409 |

*(ADRs existentes 0001–0006 permanecem válidos; RLS continua opcional por 0001.)*

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Vazamento cross-workspace | Code review + testes M1-CA-01; sempre filtrar por `workspaceId` resolvido na org |
| Deadlock / performance em Serializable | Volume M1 baixo; monitorar; downgrade para locking explícito só se necessário |
| Inconsistência 403 vs 409 entitlements | Documentar: probe M0 vs criação workspace M1 (ADR-0008) |

---

**Plan (M1):** aprovado — **gate Plan → Tasks** concluído. Ver [`tasks.md`](./tasks.md) (aguardando gate Tasks → Implement).
