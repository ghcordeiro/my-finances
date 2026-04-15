# ADR-0011: Domínio — importação OFX/CSV, lotes e lançamentos em conta (M3)

## Status

**Aceito — M3 concluído (2026-04-15).** Implementação e testes Vitest alinhados a este ADR; alterações substantivas via novo ADR.

## Contexto

O spec M3 ([`.specs/features/m3-import-ofx-csv/spec.md`](../../.specs/features/m3-import-ofx-csv/spec.md)) exige upload, templates CSV, deduplicação e lançamentos em **contas correntes** do workspace. O M1 ([ADR-0007](0007-workspace-ledger-domain.md)) modela movimentos bilateralmente via `Transfer`. Importações bancárias são movimentos **unilaterais** (contrapartida externa implícita); reutilizar `Transfer` forçaria contas fictícias e distorceria relatórios.

## Decisão

### 1. Novas entidades Prisma

- **`CsvImportTemplate`**: `id`, `organizationId`, `workspaceId` (nullable — `null` = partilhado em toda a org), `name`, `columnMap` (Json: chaves lógicas `date`, `amount` ou `debit`+`credit`, `description`, `memo?`), `dateFormat` (string, ex. `dd/MM/yyyy`), `decimalSeparator` (`','` \| `'.'`), `timezone` (IANA opcional; default aplicação `America/Sao_Paulo`), `createdAt`, `updatedAt`. Unicidade: `(organizationId, COALESCE(workspaceId, ''), name)` implementada via índice único parcial ou regra de aplicação + índice composto documentado na migração.

- **`ImportBatch`**: `id`, `organizationId`, `workspaceId`, `targetAccountId` (FK `Account`), `createdByUserId`, `originalFilename`, `contentSha256` (hex), `byteSize`, `mimeType` (nullable), `storageKey`, `status` enum `pending` \| `processing` \| `completed` \| `partial` \| `failed`, `resultSummary` (Json nullable: contagens `inserted`, `skippedDuplicate`, `parseErrors`, mensagens agregadas), `createdAt`, `completedAt` (nullable). Índice único parcial ou constraint: **não** duplicar batch bem-sucedido com mesmo `contentSha256` + `workspaceId` + `targetAccountId` quando `status IN ('completed','partial')` — detalhe exato na migração (partial unique no Postgres).

- **`AccountImportPosting`**: `id`, `organizationId`, `workspaceId`, `accountId`, `importBatchId`, `amount` (Decimal assinado: **positivo aumenta saldo da conta**), `currency` (string ISO, alinhada à conta), `bookedAt` (UTC), `memo` (nullable), `externalStableId` (string nullable — FITID OFX ou fingerprint CSV estável), `createdAt`. Índice único `(accountId, externalStableId)` **onde** `externalStableId IS NOT NULL` (partial unique) para idempotência de linha.

**Regras:** `targetAccountId` / `accountId` devem referir `Account` com o mesmo `workspaceId` do batch; conta e workspace não arquivados para **novos** imports (leitura de histórico pode manter dados antigos).

### 2. Saldo atual da conta (extensão ADR-0007)

Fórmula M3:

`currentBalance = initialBalance + Σ(creditos por Transfer entrando na conta) − Σ(débitos por Transfer saindo) + Σ(AccountImportPosting.amount para esta accountId)`

Onde créditos/débitos de `Transfer` permanecem como hoje: entrada na conta destino soma `amount`, saída na origem subtrai `amount`.

### 3. Dedupe

- **Nível lote:** segundo upload com mesmo `contentSha256` para o mesmo par `(workspaceId, targetAccountId)` com batch prévio `completed` ou `partial` → resposta **409** `duplicate_import` (ver ADR-0012).

- **Nível linha:** antes de inserir `AccountImportPosting`, se existir posting com mesmo `(accountId, externalStableId)`, **não inserir**; incrementar `skippedDuplicate` no resumo.

- **CSV sem FITID:** `externalStableId` = hash determinístico normalizado de (`bookedAt` canónico, `amount`, `memo` truncado) — algoritmo fixado no código e testado para não colidir em fixtures.

### 4. Estados do batch

- `pending` — registo criado, upload para storage pode estar em curso.
- `processing` — parser a correr.
- `completed` — sem erros de parse; todas as linhas aplicadas ou skipped.
- `partial` — algumas linhas com erro de parse OU mistura inserted + skipped com avisos (Tasks definem matriz exata).
- `failed` — erro fatal (ficheiro ilegível, conta inválida, storage); reenvio permitido.

### 5. Concorrência

Criação de postings para o mesmo `accountId` deve usar **`prisma.$transaction`** com **`Serializable`** + retry (mesmo padrão M1/M2) quando inserções concorrerem com transferências ou outro import no mesmo instante — alinhar ao serviço de saldo/transfer existente.

## Consequências

**Positivas:** modelo explícito para extratos; CA-02/03 testáveis; dedupe clara.

**Negativas:** mais uma família de movimentos no saldo; UI e exportações futuras devem agregar `Transfer` + `AccountImportPosting` (documentar em M5/M7).

**Alternativas rejeitadas:** `Transfer` para “conta externa”; tabela genérica única de “movimento” (refactor grande fora de M3).
