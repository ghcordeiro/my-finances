# Plan — M3 (importação OFX / CSV)

## Objetivo deste plano

Definir arquitetura, modelo de dados, API e políticas de deduplicação para o **marco M3** em [`.specs/features/m3-import-ofx-csv/spec.md`](./spec.md): upload de `.ofx`/`.csv`, armazenamento por tenant (ADR-0004), templates de mapeamento CSV, lotes com estado (sucesso/parcial/erro), encaixe no razão de **conta corrente** sem confundir com `Transfer` (M1), e testes de isolamento + CA-01…03.

**Nota de fecho (2026-04-15):** plano executado no âmbito API; UI opcional listada como **M3.1** em `tasks.md`.

## Escopo M3

| Incluído | Excluído (fases posteriores) |
|----------|------------------------------|
| `ImportBatch` + linhas persistidas + movimentos em conta (`AccountImportPosting` — ver ADR-0011) | Conciliação saldo OFX vs. razão (**M6**); slice mínimo só se Tasks abrir exceção explícita |
| Motor OFX (SGML/XML tolerante) e CSV via template, em **módulos puros** testáveis por Vitest | Open banking em tempo real |
| CRUD de **template CSV** com escopo org **ou** workspace (campo discriminador) | Categorização / regras automáticas (**M4**) |
| Dedupe por **hash do ficheiro** + conta alvo; chave estável por linha (FITID OFX; fingerprint CSV) | Antivírus em ficheiros (ADR-0004 consequência futura) |
| Rotas aninhadas a `workspaceId` (ADR-0008) + erros JSON estáveis (ADR-0012) | UI web obrigatória no fecho M3 (pode ficar **M3.1** como M2.1) |

## Decisões dos gray areas (spec → Plan)

| # | Decisão |
|---|---------|
| 1 | **Ledger:** não reutilizar `Transfer` (exige duas contas). Introduzir **`AccountImportPosting`** — movimento de **uma** conta, `amount` **assinado** (positivo = crédito na conta / aumenta saldo; negativo = débito), `bookedAt`, `memo`, `externalStableId` (nullable para linhas sem FITID), FK `importBatchId`. Saldo atual (ADR-0007) passa a incluir **Σ postings de importação** da conta; ADR-0011 formaliza a fórmula. |
| 2 | **Lote duplicado (mesmo ficheiro):** `contentSha256` + `workspaceId` + `targetAccountId` com batch em estado `completed` ou `partial` → **`409`** com `duplicate_import` (cumpre M3-CA-01 de forma explícita). Reenvio após `failed` permitido. |
| 3 | **Sobreposição parcial por datas (M3-RF-DED-02):** em **M3 v1** não há “substituir intervalo”. Política = **linha a linha**: se `externalStableId` já existir para a mesma `accountId`, **ignorar linha** (idempotência) e registar em metadados do batch (`skippedDuplicateLines`); batch pode terminar `partial` se houve linhas novas + ignoradas, ou `completed` se todas ignoradas sem erro (nesse caso 200 com contagens zero é aceitável — Tasks fixa resposta). **Não** apagar movimentos existentes por intervalo de datas neste marco. |
| 4 | **Templates CSV (M3-RF-MAP-01):** modelo com `organizationId` obrigatório e **`workspaceId` opcional** — `null` = template **partilhado na org**; preenchido = template **privado ao workspace**. Nome único por `(organizationId, workspaceId, name)` com regra de unicidade documentada no ADR. |
| 5 | **Upload (M3-RF-UPL-01):** extensões `.ofx`/`.csv`; tamanho máximo **10 MiB**; MIME secundário: `application/x-ofx`, `text/xml`, `text/csv`, `application/vnd.ms-excel` (alguns browsers); validação final por extensão + assinatura mínima OFX (`OFXHEADER` / `<OFX>`). |
| 6 | **Chave de armazenamento (ADR-0004):** `{organization_id}/workspaces/{workspace_id}/imports/{batch_id}/{uuid}-{filename_sanitized}` — batch id conhecido após criar registo em DB em transação com metadados, ou UUID pré-gerado; Tasks alinham com implementação de storage existente. |
| 7 | **Processamento:** **síncrono** na API para M3 (transação ou sub-transação por batch), limite de linhas **10 000** por ficheiro no Plan; acima → `422` `import_too_many_lines` (evita timeouts silenciosos). Evolução assíncrona = ADR futuro. |
| 8 | **Timezone:** datas OFX/CSV sem offset → interpretar em **`America/Sao_Paulo`** por omissão; `bookedAt` persistido em **UTC** (coerente com M1/M2). Template CSV pode declarar `timezone` opcional (Tasks). |

## Rastreio spec → entregáveis

| Requisito / CA | Entregável técnico |
|----------------|-------------------|
| M3-RF-UPL-* | Rota multipart `POST .../imports`, serviço `import-upload.ts`, integração storage |
| M3-RF-MAP-01 | Rotas CRUD `.../csv-templates`, Prisma `CsvImportTemplate` |
| M3-RF-DED-* | Constraints + serviço `import-parse.ts` / `import-apply.ts`; resposta de batch com contagens |
| M3-RF-LED-01 | Prisma `ImportBatch`, `AccountImportPosting`; atualização de agregação de saldo em leituras de conta |
| M3-RNF-01 | Filtros `organizationId` + `workspaceId` em todas as queries; teste espelhando `tenant-isolation.test.ts` |
| M3-RNF-02 | Pacotes ou pastas `apps/api/src/import/ofx/*`, `csv/*` sem dependência de Fastify nos parsers |
| M3-RNF-03 | Catálogo de códigos em ADR-0012 + handler único |
| M3-CA-01 | Vitest: dois `POST` com mesmo bytes → segundo 409 ou contagens zero conforme decisão §2 |
| M3-CA-02 | Fixture CSV + template em `src/__tests__/fixtures/` |
| M3-CA-03 | Teste cross-org em imports e presigned keys (se aplicável) |

## Componentes lógicos

1. **Pre-handlers** — `requireAuth`, `requireOrgContext`, `loadWorkspaceInOrg` (M1).

2. **Serviço CSV templates** — CRUD; validação de colunas mínimas (`date`, `amount` ou par débito/crédito); serialização JSON segura.

3. **Serviço Import upload** — valida quota/tamanho, calcula `sha256`, cria `ImportBatch` `pending` → grava objeto → `processing` → parser.

4. **Motor OFX** — extrai `BANKTRANLIST` / `STMTTRN`; mapeia `TRNAMT`, `DTPOSTED`, `FITID`, `MEMO`/`NAME`; módulo testável.

5. **Motor CSV** — aplica template; erros por linha acumulados no batch.

6. **Serviço Import apply** — transação: inserir `AccountImportPosting` com skip de `externalStableId` duplicado; atualizar `ImportBatch` status + `resultSummary` JSON.

7. **API conta** — estender cálculo de `currentBalance` (ou equivalente) para incluir postings (ver ADR-0011).

8. **Web (opcional M3)** — se Tasks incluírem onda UI: página de importação sob `/app/workspaces/:id/imports` com RNF-UI-01 / Stitch quando existir manifest.

## Modelo de dados (resumo)

Ver **ADR-0011**: `ImportBatch`, `AccountImportPosting`, `CsvImportTemplate`; enums `ImportBatchStatus`; índices para dedupe e listagens por workspace.

## Segurança

- Nunca confiar em `organizationId`/`workspaceId` do multipart para autorização — derivar do path + membership; `accountId` no body deve pertencer ao **mesmo** `workspaceId` da URL.
- URLs assinadas de storage: emitir só após verificar batch/conta na org (padrão M0).

## Observabilidade

- Logs com `importBatchId`, `workspaceId`, `targetAccountId`, contagens `inserted`/`skipped`/`errors`.
- `appendAudit` para criação/conclusão de batch e alterações de template.

## Brownfield

`apps/api` (Fastify, Prisma, Vitest). Reutilizar formato de erro `{ "error": "<code>", "message"?: string, "details"?: … }` dos marcos anteriores.

## Diagramas C4

- **L1 + L2:** [`docs/architecture/c4-m3-import-ofx-csv.md`](../../../docs/architecture/c4-m3-import-ofx-csv.md)

> **Validação spec-driven (C4):** níveis **L1 + L2** (padrão médio/grande). Diagrama de sequência upload → storage → parse opcional em Tasks.

## ADRs desta fase

| ADR | Tema |
|-----|------|
| [0011](../../../docs/adr/0011-import-ofx-csv-domain.md) | Entidades, saldo, dedupe, template scope, limites |
| [0012](../../../docs/adr/0012-api-import-ofx-csv-scoping.md) | Rotas REST, multipart, códigos de erro, auditoria |

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| OFX bancários malformados | Parser tolerante + testes com fixtures reais anonimizadas; erros `invalid_file` com detalhe não sensível |
| Colisão FITID entre bancos | Chave composta `(accountId, externalStableId)`; prefixar com `sourceSystem` no ADR se necessário |
| Transação longa em ficheiros grandes | Limite de linhas; transação única por batch apenas se perf aceitável — caso contrário Tasks subdividem (não no Plan) |
| Drift saldo conta | Uma função `getAccountBalanceComponents` testada; invariantes em Vitest |

---

**Plan (M3):** **aprovado (2026-04-15)** — gate **Plan → Tasks** aberto; redigir/aprovar [`tasks.md`](./tasks.md) antes de **Implement**.  
**Specify:** [spec.md](./spec.md) (aprovado).  
**Tasks:** [`tasks.md`](./tasks.md) — **rascunho entregue (2026-04-15)**; aguarda aprovação antes do gate **Tasks → Implement**.
