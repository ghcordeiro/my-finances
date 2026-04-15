# ADR-0003: Runtime da API e persistência

## Status

Aceito — 2026-04-15

## Contexto

`CONSTITUTION.md` §5 e PRD sugerem Node ou Java. O repositório ainda não tem código; precisamos fixar stack para planos de deploy, ORM e contratação de dependências.

## Decisão

- **Runtime:** Node.js LTS atual (22.x ou LTS vigente no momento da implementação).
- **Linguagem:** TypeScript strict.
- **Framework HTTP:** **Hono** (leve, edge-ready) ou **Fastify** — escolha final no primeiro commit de API: **Fastify** se prioridade for ecossistema maduro de plugins; **Hono** se prioridade for deploy em workers/edge. *Lock:* **Fastify 5** como padrão inicial por plugins estáveis (rate-limit, cookie, multipart futuro).
- **ORM / migrations:** **Prisma** com PostgreSQL.
- **Banco:** PostgreSQL gerenciado em produção; Docker Compose local.

## Consequências

**Positivas:** alinhamento ao ecossistema PRD; tipagem; migrações declarativas.

**Negativas:** Prisma impõe modelo mental próprio; cold start menor que Spring mas não zero.

**Alternativa rejeitada no M0:** Java/Spring (viável porém mais peso operacional para time mínimo — pode ser revisitada por ADR se surgir requisito forte JVM).
