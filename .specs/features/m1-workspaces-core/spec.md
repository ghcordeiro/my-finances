# M1 — Workspaces e núcleo financeiro (contas + transferências)

Especificação da **primeira fatia do marco M1** do `ROADMAP.md`. Refina e torna verificáveis os requisitos globais **RF-WSP-01…03** e **RF-ACC-01…03** de `.specs/features/product-v1/spec.md`, assumindo **M0 concluído** (organização, sessão, `X-Organization-Id`, entitlements, auditoria append).

## System Process Context

Dentro de uma **organização (inquilino)** autenticada, o titular (ou membro com permissão) passa a operar em um **workspace** explícito: unidade de isolamento lógico para **contas** (corrente e investimento) e **transferências**. Toda leitura e escrita de dados financeiros desta fatia exige **dois** contextos válidos: **organização** (já obrigatório na API M0) e **workspace** (novo). Dados de um workspace não aparecem em listagens ou totais de outro workspace da mesma organização. Transferências entre contas do **mesmo** workspace e entre contas de **workspaces distintos** da mesma organização (ex.: PF ↔ PJ) são permitidas quando as regras de permissão e tipo de workspace forem satisfeitas.

**Atores:** usuário com `Membership` ativo na organização (papéis M0: `owner`, `member`). **Sistemas:** API REST versionada, PostgreSQL, trilha de auditoria existente.

**Pré-condições M0:** sessão válida; cabeçalho ou contrato equivalente de contexto de organização; enforcement de **RF-PLT-01** mantido.

## User stories (esta fatia)

1. Como **owner**, quero **criar, renomear e arquivar workspaces** (PF ou PJ) até o limite do meu plano, para separar finanças pessoais e de cada empresa.
2. Como **membro**, quero **listar apenas workspaces aos quais tenho acesso** (M1 assume acesso a todos os workspaces da org para `member`; refinamento por workspace fica fora desta fatia), para trabalhar no contexto certo.
3. Como usuário autenticado, quero **selecionar um workspace ativo** (persistido na sessão de UI ou enviado em cada requisição de API), para que todas as operações de contas e transferências usem esse escopo.
4. Como titular, quero **cadastrar contas** (corrente e investimento) com saldo inicial e moeda, **por workspace**, para acompanhar posição.
5. Como titular, quero **registrar transferências** entre contas do mesmo workspace e entre PF e PJ **na mesma organização**, com valor, data e descrição, para rastrear pró-labore, reembolsos e movimentações internas.
6. Como **owner**, quero que o sistema **respeite o limite `maxWorkspaces` do plano** ao criar workspace, para alinhar uso ao entitlement já modelado no M0.

## Requisitos funcionais (IDs — M1)

### M1-RF-WSP — Workspaces

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M1-RF-WSP-01 | CRUD lógico de workspace: criar, renomear, arquivar (soft-delete ou flag `archived`); todo workspace pertence a **exatamente uma** `organization_id`. | RF-WSP-01 |
| M1-RF-WSP-02 | Cada workspace possui **tipo** `personal` (PF) ou `business` (PJ) e **nome** legível; nomes duplicados na mesma org são permitidos, desde que identificação seja por `id`. | ROADMAP M1 |
| M1-RF-WSP-03 | Listagem de workspaces da organização retorna apenas workspaces daquela org; operações por `id` validam pertença à org do contexto. | RF-PLT-01 + RF-WSP-01 |
| M1-RF-WSP-04 | Criação de workspace incrementa uso contra **entitlement** `maxWorkspaces` do plano da organização; ao exceder, resposta **409** com corpo estável (código/mensagem). | RF-PLT-05 |
| M1-RF-WSP-05 | Toda entidade financeira introduzida nesta fatia (**conta**, **transferência**) carrega `organization_id` e `workspace_id` (ou referências equivalentes no modelo). | RF-WSP-03 |

### M1-RF-ACC — Contas

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M1-RF-ACC-01 | Cadastrar **múltiplas contas** por workspace, com: nome, tipo (`checking` \| `investment`), **moeda** (default `BRL`), **saldo inicial** (valor decimal ≥ 0 na moeda da conta). | RF-ACC-01 |
| M1-RF-ACC-02 | Listar e obter contas **filtradas pelo workspace** solicitado; nunca retornar conta de outro workspace ou outra organização. | RF-WSP-01 |
| M1-RF-ACC-03 | **Saldo atual** da conta = saldo inicial + soma algébrica das transferências **onde a conta é origem ou destino** dentro do escopo permitido (ver M1-RF-TFR). Exposição via API de leitura (detalhe da conta ou campo em listagem). | RF-ACC-02 |

### M1-RF-TFR — Transferências

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M1-RF-TFR-01 | Registrar transferência com: `fromAccountId`, `toAccountId`, `amount` > 0, `currency` (deve coincidir com a moeda das contas), `bookedAt` (data contábil), `memo` opcional. | RF-ACC-03 |
| M1-RF-TFR-02 | **Intra-workspace:** origem e destino pertencem ao **mesmo** `workspace_id`. | RF-ACC-03 |
| M1-RF-TFR-03 | **Inter-workspace (PF ↔ PJ):** origem e destino pertencem à **mesma organização**, a workspaces distintos; permitido somente combinações `personal` ↔ `business` (não entre dois PF nem entre dois PJ nesta fatia, salvo decisão explícita futura). | RF-ACC-03 |
| M1-RF-TFR-04 | Rejeitar transferência se contas em moedas diferentes ou se qualquer conta estiver arquivada/inativa. | Integridade |
| M1-RF-TFR-05 | Listagem de transferências por workspace: incluir transferências onde **qualquer** ponta está no workspace selecionado (visão do fluxo que cruza o limite). | UX mínima |

### M1-RF-AUD — Auditoria (extensão M0)

| ID | Requisito | Rastreio |
|----|-----------|----------|
| M1-RF-AUD-01 | Eventos de auditoria append-only para: criação/edição/arquivamento de workspace; criação/edição/arquivamento de conta; criação de transferência. Metadados devem incluir `workspaceId` e `organizationId` quando aplicável. | RF-PLT-06 |

## Requisitos não funcionais (esta fatia)

| ID | Requisito |
|----|-----------|
| M1-RNF-01 | Mesmas garantias de **isolamento por organização** do M0; testes automatizados cobrindo **isolamento por workspace** dentro da mesma org. |
| M1-RNF-02 | API versionada (`/v1/...`) coerente com o estilo existente; erros 4xx com payload JSON estável. |
| M1-RNF-03 | Migrações Prisma reversíveis na prática (down) ou estratégia documentada no Plan se houver limitação. |

## Critérios de aceite (M1)

- **M1-CA-01:** Dado org A com workspaces W1 e W2, contas criadas em W1 **não** aparecem em `GET` de contas com contexto W2.
- **M1-CA-02:** Usuário de org B não acessa workspace/conta/transferência de org A por `id` conhecido (403 ou 404 conforme política já usada no M0).
- **M1-CA-03:** Com `maxWorkspaces = N`, a tentativa de criar o **(N+1)-ésimo** workspace ativo retorna **409** e não persiste linha.
- **M1-CA-04:** Transferência intra-workspace atualiza saldos de ambas as contas de forma consistente (valor debitado em uma = creditado na outra, mesma moeda).
- **M1-CA-05:** Transferência `personal` ↔ `business` na mesma org persiste e aparece nas listagens dos workspaces envolvidos.
- **M1-CA-06:** Auditoria registra ao menos uma entrada por criação de workspace, conta e transferência (ação e ids rastreáveis).

## Referência de UI (Stitch)

A superfície web desta fatia deve **alinhar-se** ao projeto Stitch *My Finances Unified Manager* (`stitchProjectId` em `docs/design/stitch-reference/manifest.json`). Índice e normas: [`docs/design/README.md`](../../../docs/design/README.md).

| Área M1 | Tela Stitch (título) | Artefacto |
|---------|------------------------|-----------|
| Login / cadastro (contexto pré-workspace) | Login / Cadastro | `screens/login-cadastro-*.html` |
| Lista / CRUD de workspaces | Gerenciar Workspaces | `screens/gerenciar-workspaces-*.html` |
| Contas no workspace ativo | Contas do Workspace | `screens/contas-do-workspace-*.html` |
| Transferências (intra e PF↔PJ) | Transferências e Fluxos | `screens/transferencias-e-fluxos-*.html` |
| Organização / plano (contexto tenant) | Configurações da Organização | `screens/configuracoes-da-organizacao-*.html` |

O **Plan** de M1 deve mencionar estes ficheiros ao definir rotas (`/app/...`) e componentes; o **Implement** compara implementação com HTML de referência e com `DESIGN-SYSTEM.md`.

## Fora de escopo (M1 — explícito)

- **RF-WSP-02** visão consolidada PF+PJ (relatórios/dashboard unificado): **não** nesta fatia.
- Cartões, faturas, parcelas (**RF-CCR***, M2).
- Importação OFX/CSV (**RF-IMP**, M3).
- Categorias, regras, IA (**RF-CAT**, M4).
- Permissão **por workspace** (ACL fina além de org): **não** nesta fatia — `member` vê todos os workspaces da organização.
- API pública / API keys (**RF-API**, M8).
- Moedas múltiplas com conversão cambial: apenas contas de **uma** moeda por transferência; multi-moeda avançada fora do M1.

## Contrato de contexto (API)

- Mantém-se o contexto de organização já exigido pelo M0 (`X-Organization-Id` ou mecanismo equivalente documentado no código).
- **Novo:** operações de leitura/escrita de contas e transferências exigem **`X-Workspace-Id`** (UUID de workspace da organização) **ou** recurso aninhado inequívoco (`/v1/organizations/:orgId/workspaces/:workspaceId/...`) — a escolha exata entre header vs. path é decisão do **Plan** (deve constar em `plan.md` + ADR se alterar padrão de segurança observabilidade).

## Gray areas / decisões adiadas ao Plan

1. **Semântica de arquivamento:** workspace arquivado bloqueia novas transferências ou apenas criação de novas contas?
2. **404 vs. 403** para `workspace_id` de outra org (alinhar ao padrão atual de recursos).
3. **Saldo e concorrência:** modelo otimista (version) vs. transação serializável apenas na escrita de transferência.
4. **Onboarding:** criar workspace PF default automaticamente na criação da org (retrocompat seed) ou exigir passo explícito na UI.

---

**Specify (M1):** aprovado para planejamento (utilizador avançou para Plan).

**Plan (M1):** ver [`plan.md`](./plan.md); ADRs [`0007`](../../../docs/adr/0007-workspace-ledger-domain.md), [`0008`](../../../docs/adr/0008-api-workspace-scoping.md); C4 em [`docs/architecture/c4-m1-workspaces.md`](../../../docs/architecture/c4-m1-workspaces.md).

**Tasks:** [`tasks.md`](./tasks.md) — **M1 encerrado (2026-04-15)** (Implement + checklist + E2E smoke M1-T-009).
