# Plan — Product v1 (incremento M0: Plataforma SaaS)

## Objetivo deste plano

Definir arquitetura e componentes para o **incremento M0** do roadmap: organização multi-tenant, identidade, autorização, assinatura/entitlements mínimos, auditoria, storage isolado e base para API versionada — **sem** ainda implementar workspaces financeiros completos (M1), mas com **modelo de dados e contratos** que permitam acrescentar M1 sem refatoração destrutiva.

## Escopo do incremento (M0)

| Incluído | Excluído (M1+) |
|----------|----------------|
| CRUD lógico de `Organization`, membership, roles owner/member | Contas, cartões, transações |
| Signup → cria org + owner; login; logout; refresh de sessão | Importação OFX/CSV |
| Tabela `subscription` + integração Stripe (ou stub documentado) + webhooks | Motor de faturas |
| `AuditLog` append-only para eventos da lista RF-PLT-06 | Dashboards analíticos |
| Config de storage (prefixo por `organization_id`) e upload “ping” opcional | Categorização / LLM |
| Middleware global: usuário autenticado + `organization_id` resolvido e autorizado | API keys públicas (deixar contrato preparado em ADR) |

## Rastreio spec → entregáveis M0

| Requisito | Entregável técnico |
|-----------|-------------------|
| RF-PLT-01 | Coluna `organization_id` em todas as tabelas de domínio futuras; middleware que injeta tenant; testes de isolamento |
| RF-PLT-02 | Fluxo API + UI: registro cria `users`, `organizations`, `memberships` (owner) |
| RF-PLT-03 | Ver ADR-0002 (sessão/credenciais) |
| RF-PLT-04 | RBAC: `role` em `membership`; guards por rota |
| RF-PLT-05 | `plan_tier` + limites; enforcement stub (constantes) até Stripe ativo |
| RF-PLT-06 | Tabela `audit_logs` + serviço de append em eventos listados |
| RF-PLT-07 | Especificação de export JSON agregado + job assíncrono futuro; delete lógico ou hard com fila (detalhe em implementação) |
| CA-00 | Suite de testes: dois orgs, mesmos nomes de recurso, zero vazamento |

## Componentes lógicos

1. **API HTTP** — REST `/v1`, JSON, OpenAPI gerado ou mantido à mão no M0.
2. **Módulo Identity** — registro, login, verificação de e-mail (fila ou síncrono mínimo), reset de senha.
3. **Módulo Tenancy** — resolução de organização ativa (header ou cookie de contexto), convites (pode ser M0.1 se apertar escopo).
4. **Módulo Billing** — cliente Stripe, webhooks idempotentes, persistência de estado de assinatura.
5. **Módulo Audit** — escritor estruturado (who, org, action, metadata).
6. **Worker (opcional M0)** — processar webhooks fora do request cycle se necessário; senão handler síncrono com fila futura documentada.
7. **Web App** — páginas públicas mínimas (login, cadastro), shell autenticado vazio (“Dashboard em breve”).

**Motores de domínio** (importação, parcelamento): **não** existem como código no M0; apenas **pacotes/módulos vazios** ou boundary interfaces em ADR para não violar CONSTITUTION §3.

## Modelo de dados (alto nível)

- `users` — identidade global do usuário humano.
- `organizations` — tenant; `slug` opcional; timestamps.
- `memberships` — (`user_id`, `organization_id`, `role`, `status`).
- `sessions` ou equivalente — conforme ADR-0002.
- `subscriptions` — `organization_id`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `plan_code`, períodos.
- `audit_logs` — `id`, `organization_id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata` JSONB, `created_at`.
- `plan_entitlements` — tabela estática ou seed: limites por `plan_code`.

Workspaces (M1): tabela `workspaces` com `organization_id` FK — apenas migração esqueleto permitida no M0 se facilitar foreign keys.

## Segurança

- TLS obrigatório em produção; HSTS; cookies `Secure`, `HttpOnly`, `SameSite=Lax` (ajustar para SSO futuro).
- Rate limit em `/v1/auth/*` por IP + por e-mail.
- Senhas: Argon2id (preferido) ou bcrypt custo adequado — detalhe em ADR-0002.
- Webhooks Stripe: validação de assinatura do payload.

## Observabilidade

- Logs JSON (`pino` ou equivalente) com `request_id`, `user_id`, `organization_id` quando aplicável.
- Métricas HTTP básicas (latência, 5xx) — provedor definido no deploy (ex.: OpenTelemetry → backend APM).

## Brownfield

Repositório sem código de aplicação ainda — **sem** duplication-hunter aplicável.

## UI (M0)

Superfície mínima: fluxo de cadastro/login, seleção de organização se multi-org no futuro (M0 pode fixar uma org por usuário no primeiro login). Componentes: formulários acessíveis, mensagens de erro genéricas (anti-enumeração de contas). Detalhe de acessibilidade na fase Implement.

## Diagramas C4

- **L1 Contexto:** `docs/architecture/c4-platform-m0.md` (seção Context)
- **L2 Contêineres:** mesmo arquivo (seção Containers)

## ADRs relacionados

| ADR | Tema |
|-----|------|
| [0001](../../docs/adr/0001-multi-tenant-isolation.md) | Isolamento multi-tenant |
| [0002](../../docs/adr/0002-authentication-session.md) | Autenticação e sessão |
| [0003](../../docs/adr/0003-runtime-and-persistence.md) | Runtime, ORM, PostgreSQL |
| [0004](../../docs/adr/0004-object-storage.md) | Object storage |
| [0005](../../docs/adr/0005-billing-stripe.md) | Faturação Stripe |
| [0006](../../docs/adr/0006-api-organization-context.md) | Contexto de organização na API |

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Vazamento cross-tenant | Code review obrigatório em queries; testes CA-00; considerar RLS em ADR futuro |
| Webhooks Stripe duplicados | Idempotência por `event_id` persistido |
| Escopo M0 infla | Congelar M0 sem convites multi-usuário se necessário; documentar como M0.1 |

---

**Plan:** aprovado. **Tasks:** ver `tasks.md` (TDAD). **Gate Tasks → Implement:** concluído (M0 entregue).
