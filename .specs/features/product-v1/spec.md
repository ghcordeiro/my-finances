# Product v1 — Especificação de sistema (rastreio ao PRD + premissa SaaS)

## System Process Context

O produto é um **SaaS multi-tenant** em nuvem. Cada **organização (inquilino)** paga ou adere a um plano, autentica usuários e opera **workspaces** PF/PJ isolados entre si e **estritamente** isolados de outras organizações. A camada de registro e projeção (extratos, faturas, parcelas, conciliação, categorização, relatórios) roda sempre com **contexto de tenant** obrigatório em API, jobs e armazenamento de arquivos.

**Atores:** usuário autenticado (papéis variados), opcionalmente contador convidado (leitura). **Sistemas externos:** provedor de identidade (se terceirizado), pagamentos, armazenamento de objetos, arquivos OFX/CSV dos bancos; LLM opcional conforme política do inquilino (BYOK, provedor contratado ou recurso desligado).

## User stories (epics)

0. Como **organização**, quero **cadastro, assinatura e isolamento de dados**, para usar o produto como serviço sem compartilhar dados com outros clientes.
1. Como titular, quero **workspaces separados** (PF / cada PJ) **dentro da minha organização**, para não misturar fluxos nem relatórios por engano.
2. Como titular, quero **cadastrar contas e cartões** com datas de fechamento/vencimento e limites, para acompanhar caixa real e rotativo.
3. Como titular, quero **importar OFX e CSV** com templates e sem duplicar lançamentos, para alimentar o sistema rapidamente.
4. Como titular, quero **parcelas gerarem lançamentos futuros nas faturas corretas**, para ver projeção de caixa e limite.
5. Como titular, quero **regras e IA** para categorizar em massa, revisando só exceções, **respeitando a política de privacidade do meu plano/tenant**.
6. Como titular, quero **dashboard e alertas** (orçamento, recorrências), para corrigir curso antes do fim do mês.
7. Como titular, quero **conciliação de saldo** com o OFX, para confiar que nada sumiu entre importações.
8. Como titular PJ, quero **anexar comprovantes** e **exportar fechamento** para o contador (e opcionalmente convidar acesso read-only **auditável**).

## Requisitos funcionais (IDs)

### RF-PLT — Plataforma SaaS

| ID | Requisito | Origem |
|----|-----------|--------|
| RF-PLT-01 | Cada registro financeiro, template de CSV, anexo e configuração sensível deve pertencer a exatamente **um** inquilino (organização); APIs e jobs devem rejeitar requisições sem contexto de tenant válido. | Premissa SaaS |
| RF-PLT-02 | Fluxo de **onboarding**: criação de organização + primeiro usuário owner + estado inicial de assinatura (trial ou plano). | Premissa SaaS |
| RF-PLT-03 | **Autenticação** de usuários humanos (e-mail/senha ou provedor social/OIDC — detalhe em ADR). | Premissa SaaS |
| RF-PLT-04 | **Autorização** baseada em papéis por organização (mínimo: owner, member; extensível para accountant). Nenhuma leitura/escrita cross-tenant. | Premissa SaaS |
| RF-PLT-05 | **Entitlements** derivados do plano (limites de workspaces, armazenamento, uso de IA, API); enforcement na API e onde couber em UI. | Premissa SaaS |
| RF-PLT-06 | **Auditoria** de ações sensíveis: convites, mudança de papel, exportações, alteração de plano, acesso contador. | Premissa SaaS |
| RF-PLT-07 | **Exportação de dados** e fluxo de **exclusão de conta/organização** (retenção mínima legal a definir em plano/compliance) documentados e implementáveis. | Premissa SaaS |

### RF-WSP — Workspaces e perfis

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-WSP-01 | Suportar múltiplos workspaces **por organização**, com isolamento lógico (transações, contas, cartões, anexos) entre workspaces. | 3.1 |
| RF-WSP-02 | Permitir visão consolidada explícita (ex.: distribuição de lucros) sem misturar dados por padrão entre workspaces. | 3.1 |
| RF-WSP-03 | Toda entidade financeira persistente deve referenciar **organização** e **workspace** donos. | 3.1 + SaaS |

### RF-ACC — Contas e transferências

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-ACC-01 | Cadastrar múltiplas contas (corrente e investimento) por workspace, com saldo inicial. | 3.1 |
| RF-ACC-02 | Exibir saldo consolidado por workspace e por conta. | 3.1 |
| RF-ACC-03 | Registrar transferências internas entre contas do mesmo workspace e entre PF e PJ (pró-labore, reembolso), com rastreabilidade. | 3.1 |

### RF-CCR — Cartões e faturas

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-CCR-01 | Cadastrar cartão vinculado a workspace, com limite total, limite disponível, dia de fechamento e dia de vencimento. | 3.2 |
| RF-CCR-02 | Abrir e fechar faturas (ciclos) automaticamente conforme datas de corte. | 3.2 |
| RF-CCR-03 | Lançamento parcelado gera transações filhas projetadas nas faturas futuras (ex.: 1/12 … 12/12). | 3.2 |
| RF-CCR-04 | Suportar antecipação de parcelas e recálculo coerente de limite disponível. | 3.2 |
| RF-CCR-05 | Tratar estornos e cashbacks como créditos que abatem dívida ou anulam transação referenciada. | 3.2 |

### RF-IMP — Importação

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-IMP-01 | Aceitar upload em lote de `.ofx` e `.csv` (armazenamento isolado por tenant). | 3.3 |
| RF-IMP-02 | Permitir salvar e reaplicar templates de mapeamento de colunas CSV por instituição/formato **no escopo do tenant** (ou workspace, se assim decidir o plano). | 3.3 |
| RF-IMP-03 | Evitar duplicatas na reimportação (mesmo arquivo ou sobreposição de intervalos) via hash ou identificador estável **por workspace**. | 3.3 |

### RF-CAT — Categorias, tags, regras, IA

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-CAT-01 | Categorias hierárquicas (pai > filho) e tags livres nas transações. | 3.4 |
| RF-CAT-02 | Motor de regras condicionais sobre descrição (e campos acordados) para atribuir categoria/tag automaticamente. | 3.4 |
| RF-CAT-03 | Enviar lote de transações não categorizadas a provedor de IA **permitido pela política do tenant**; resposta estruturada (ex.: JSON com categoria sugerida). | 3.4 |
| RF-CAT-04 | Suportar **desligar** categorização por LLM em nuvem **e/ou** usar **BYOK** / endpoint configurável pelo tenant, sem obrigar envio a um modelo fixo do fornecedor do SaaS. | 4.1 + SaaS |

### RF-DSH — Dashboard e insights

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-DSH-01 | Visão geral: saldo consolidado de contas, faturas abertas, itens a vencer em 7 dias. | 3.5 |
| RF-DSH-02 | Gráficos por categoria/subcategoria com filtro competência (data compra) vs. caixa (pagamento de fatura). | 3.5 |
| RF-DSH-03 | Alertas: categorias acima de orçamento mensal; assinaturas recorrentes com aumento de valor. | 3.5 |

### RF-REC — Conciliação

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-REC-01 | Após importação OFX, comparar saldo calculado no sistema com saldo informado no cabeçalho/agregado do extrato. | 3.6 |
| RF-REC-02 | Em divergência, alertar e orientar revisão (possíveis lançamentos faltantes ou duplicados). | 3.6 |

### RF-ATT — Anexos

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-ATT-01 | Anexar arquivos a transações (PDF, imagem, etc.), com metadados mínimos; **objetos armazenados com isolamento por tenant** (prefixo ou bucket lógico). | 3.7 |

### RF-EXP — Exportação e contador

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-EXP-01 | Gerar pacote de fechamento mensal filtrado por workspace PJ (formato a definir no plano: PDF/planilha/remessa). | 3.8 |
| RF-EXP-02 | (Opcional) Perfil read-only para contador acessar dashboard PJ e baixar relatórios, **com convite por organização e trilha de auditoria**. | 3.8 |

### RF-API — Extensibilidade

| ID | Requisito | Origem PRD |
|----|-----------|------------|
| RF-API-01 | Expor API para criação/atualização de despesas/recebimentos sem upload de arquivo, com **autenticação e escopo de tenant** (ex.: API keys por org). | 4.2 |
| RF-API-02 | Documentar extensão futura para webhooks; rate limiting por tenant. | 4.2 |

## Requisitos não funcionais (IDs)

| ID | Requisito | Origem |
|----|-----------|--------|
| RNF-SEC-01 | Hospedagem em nuvem com controles de acesso, criptografia em trânsito e em repouso alinhados ao nível de sensibilidade financeira; **sem vazamento cross-tenant**. | PRD 4 + SaaS |
| RNF-SEC-02 | Segredos e chaves apenas via cofre/ambiente seguro; rotação e princípio do menor privilégio para serviços. | PRD 4 |
| RNF-SEC-03 | Conformidade operacional mínima: política de retenção, backup e recuperação documentados (detalhes no plano de operação, não neste spec). | SaaS |
| RNF-ARC-01 | Motores de importação e parcelamento desacoplados da camada de apresentação. | PRD 4 |
| RNF-ARC-02 | Stack concreta documentada em ADR (DB gerenciado, storage, filas se houver). | PRD 4 |

## Critérios de aceite globais (release v1)

- **CA-00:** Dois inquilinos distintos com dados homônimos não se veem em nenhuma listagem, export ou API autenticada (testes automatizados de isolamento).
- **CA-01:** Dentro de um inquilino, é possível criar ≥2 workspaces e garantir que listagens padrão não vazam dados entre workspaces.
- **CA-02:** Importar o mesmo OFX duas vezes no mesmo workspace não aumenta contagem de transações novas (dedupe efetivo).
- **CA-03:** Compras parceladas aparecem automaticamente em faturas futuras até encerrar o plano.
- **CA-04:** Saldo pós-importação OFX coincide com o extrato ou o sistema exibe alerta de conciliação.
- **CA-05:** Administrador do tenant pode desativar LLM em nuvem ou configurar BYOK conforme políticas implementadas; categorização manual/regras permanecem utilizáveis.

## Fora de escopo (v1 explícito no PRD)

- Open banking em tempo real (arquivos estáticos continuam como fonte principal na v1).
- Uso de dados de um tenant para treinar modelos proprietários do fornecedor **sem** consentimento contratual explícito (fora de escopo ético/legal alvo).

## Gray areas (para `context.md` ou ADRs)

1. **Formato exato** do pacote “contador” (PDF razão vs. CSV vs. remessa contábil).
2. **Modelo de identidade:** só e-mail/senha vs. OIDC enterprise; convite contador com magic link vs. SSO cliente.
3. **Consolidada PF+PJ:** relatório apenas vs. lançamentos espelhados.
4. **Preço e limites:** por organização, por seat, por workspace ou híbrido.
5. **Residência de dados** (uma região vs. multi-região no v1).

---

**Specify:** aprovado. **Plan:** ver `plan.md` (incremento M0), ADRs em `docs/adr/` e C4 em `docs/architecture/c4-platform-m0.md`.

**Plan:** aprovado. **Tasks:** ver `tasks.md` (TDAD, incremento M0).

**Gate Tasks → Implement:** concluído (2026-04-15); M0 encerrado. Próximo: M1 conforme `ROADMAP.md`.
