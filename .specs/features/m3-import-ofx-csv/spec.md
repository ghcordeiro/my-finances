# M3 — Importação OFX / CSV

Especificação do **marco M3** do [`ROADMAP.md`](../../project/ROADMAP.md), refinando **RF-IMP-01…03** e o critério global **CA-02** de [`.specs/features/product-v1/spec.md`](../product-v1/spec.md). Assume **M0–M2 concluídos** (organização, sessão, workspaces, contas, transferências, cartões/faturas manuais, storage S3-compatível por tenant).

**Nota de fecho (2026-04-15):** entrega API M3 verificada por testes e checklist em [`tasks.md`](./tasks.md); superfície web dedicada a imports fica em backlog **M3.1** (opcional).

## System Process Context

Dentro de um **workspace**, o utilizador envia **ficheiros OFX e/ou CSV** de extratos bancários ou cartão; o sistema **armazena o objeto** com prefixo por organização, **interpreta** o formato (OFX estruturado; CSV via template), **cria lançamentos** nas contas correntes do workspace (ou fluxo acordado no Plan) e **evita duplicar** transações já importadas (hash / chave estável por workspace). **Templates CSV** podem ser guardados e reaplicados por instituição ou formato, no âmbito do tenant.

**Atores:** titular com `Membership` ativo. **Sistemas:** API `/v1`, storage de objetos (ADR-0004), PostgreSQL.

**Pré-condições:** sessão válida; `X-Organization-Id`; `workspaceId` inequívoco (path ou recurso aninhado, coerente com ADR-0008).

## User stories (M3)

1. Como titular, quero **carregar um ficheiro OFX** de uma conta do workspace para criar movimentos automaticamente.
2. Como titular, quero **carregar CSV** com colunas heterogéneas usando um **template** guardado, para não remapear sempre.
3. Como titular, quero **reimportar o mesmo ficheiro** sem duplicar linhas no razão (dedupe).
4. Como titular, quero **ver o estado** do lote (sucesso, parcial, erros) e poder corrigir e reenviar.

## Requisitos funcionais (IDs — M3)

### M3-RF-UPL — Upload e armazenamento

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M3-RF-UPL-01 | Aceitar upload de `.ofx` e `.csv` com limite de tamanho e tipos MIME/validação de extensão acordados no Plan. | RF-IMP-01 |
| M3-RF-UPL-02 | Persistir ficheiro em storage **isolado por `organization_id`** (prefixo de chave); metadados mínimos (nome, tamanho, hash, workspace, utilizador). | RF-IMP-01, ADR-0004 |

### M3-RF-MAP — Templates CSV

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M3-RF-MAP-01 | CRUD de **template** de mapeamento (coluna data, valor, descrição, memo opcional, débito/crédito se aplicável) no escopo **tenant** ou **workspace** — decisão explícita no Plan. | RF-IMP-02 |

### M3-RF-DED — Dedupe e idempotência

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M3-RF-DED-01 | Identificador estável por importação (ex.: hash do ficheiro + workspace, ou FITID OFX quando existir) para **não duplicar** o mesmo lote. | RF-IMP-03, CA-02 |
| M3-RF-DED-02 | Reimportação com **sobreposição parcial** de intervalo de datas: política no Plan (rejeitar vs. mesclar vs. substituir). | RF-IMP-03 |

### M3-RF-LED — Ledger (encaixe M1)

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M3-RF-LED-01 | Lançamentos importados associam-se a **conta** do workspace alvo; valores e datas coerentes com o modelo `Account`/movimento acordado no Plan (novo tipo de movimento vs. reutilização de `Transfer` — decisão no Plan). | M1, RNF-ARC-01 |

## Requisitos não funcionais (M3)

| ID | Requisito |
|----|-----------|
| M3-RNF-01 | Isolamento **org + workspace** em todas as queries e comandos; testes espelhando `tenant-isolation`. |
| M3-RNF-02 | Motor de parsing OFX/CSV em **módulo testável** sem acoplar à UI (RNF-ARC-01). |
| M3-RNF-03 | Erros 4xx com payload JSON estável (`duplicate_import`, `invalid_file`, `template_not_found`, …) — lista final no Plan/ADR. |

## Critérios de aceite (M3)

- **M3-CA-01:** Importar o mesmo OFX duas vezes no mesmo workspace **não** aumenta o número de movimentos novos (CA-02).
- **M3-CA-02:** CSV com template guardado produz lançamentos com datas e valores corretos num cenário de teste fixo (Plan define fixture).
- **M3-CA-03:** Utilizador de outra organização não acede a imports ou ficheiros de outro tenant (403/404 alinhado a M1).

## Fora de escopo (M3 — explícito)

- **Conciliação completa** saldo OFX vs. razão (RF-REC-01/02, CA-04) — marco **M6** no roadmap, salvo slice mínimo acordado no Plan.
- Open banking em tempo real.
- Categorização automática / IA (**M4**).

## Contrato de contexto (API)

- Manter `X-Organization-Id`; paths aninhados sob `/v1/workspaces/:workspaceId/...` quando aplicável (alinhado a ADR-0008).

---

**Specify (M3):** **aprovado (2026-04-15)** — gate **Specify → Plan** concluído.  
**Plan (M3):** [`plan.md`](./plan.md) **aprovado (2026-04-15)** + ADR [0011](../../../docs/adr/0011-import-ofx-csv-domain.md), [0012](../../../docs/adr/0012-api-import-ofx-csv-scoping.md), C4 [`c4-m3-import-ofx-csv.md`](../../../docs/architecture/c4-m3-import-ofx-csv.md). **Tasks:** [`tasks.md`](./tasks.md) **rascunho (2026-04-15)** — gate seguinte: **aprovação Tasks → Implement**.
