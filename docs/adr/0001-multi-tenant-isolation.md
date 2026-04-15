# ADR-0001: Isolamento multi-tenant em banco compartilhado

## Status

Aceito — 2026-04-15

## Contexto

O produto é SaaS multi-tenant (`CONSTITUTION.md` §1). Precisamos de um padrão de isolamento de dados que equilibre custo operacional, simplicidade para equipe pequena e exigência de **zero acesso cross-tenant** acidental.

## Decisão

- Um único **schema PostgreSQL** compartilhado por todos os tenants.
- Toda linha de dados de negócio carrega `organization_id` (UUID) **NOT NULL** com índice composto nas consultas frequentes.
- Toda query de leitura/escrita passa por camada de acesso que **obriga** filtro por `organization_id` derivado da sessão/membership — nunca aceitar `organization_id` arbitrário do cliente sem validar membership.
- **Defense in depth (fase posterior):** avaliar `Row Level Security` (RLS) no PostgreSQL com variável de sessão `app.current_organization_id` setada por middleware; não bloqueante para o primeiro incremento se testes CA-00 forem rigorosos.

## Consequências

**Positivas:** operações e backups simples; migrações únicas; custo de infra menor que schema-per-tenant.

**Negativas:** risco de regressão se consulta esquecer o filtro — mitigado por convenção de repositório, revisão e testes.

**Alternativas rejeitadas:** database por cliente (custo e complexidade de provisionamento); schema por tenant (migrações × N).
