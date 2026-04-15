# C4 — Plataforma M0 (My Finances)

Diagramas no formato C4 (Mermaid). **Níveis incluídos:** L1 Contexto + L2 Contêineres (padrão spec-driven). Diagrama de sequência opcional pode ser acrescentado na fase Tasks/Implement para onboarding.

---

## L1 — Diagrama de contexto

```mermaid
C4Context
title Diagrama de contexto — My Finances (M0)

Person(user, "Usuário", "Titular ou membro da organização")
System(myfin, "My Finances", "SaaS de gestão financeira (fase M0: conta e organização)")
System_Ext(stripe, "Stripe", "Assinaturas e pagamentos")
System_Ext(email, "Provedor de e-mail", "Envio transacional (verificação, reset)")
System_Ext(storage, "Object Storage S3-compatível", "Anexos e uploads futuros")

Rel(user, myfin, "Usa HTTPS")
Rel(myfin, stripe, "Webhooks + API", "HTTPS")
Rel(myfin, email, "SMTP/API", "TLS")
Rel(myfin, storage, "URLs assinadas / API", "HTTPS")
```

Visão em texto: o usuário interage com **My Finances**; o sistema integra **Stripe**, **e-mail** e **armazenamento de objetos** externos.

---

## L2 — Diagrama de contêineres

```mermaid
C4Container
title Diagrama de contêineres — Plataforma M0

Person(user, "Usuário", "Humano")

Container_Boundary(sys, "My Finances") {
  Container(web, "Web App", "SPA (ex.: React/Vite)", "UI: cadastro, login, shell autenticado")
  Container(api, "API", "Node.js + Fastify + TypeScript", "REST /v1, auth, tenancy, billing, audit")
  ContainerDb(db, "PostgreSQL", "Relacional", "Usuários, orgs, sessões, assinaturas, audit_logs")
}

System_Ext(stripe, "Stripe", "Pagamentos")
System_Ext(s3, "S3 / R2 / MinIO", "Objetos")
System_Ext(smtp, "E-mail transacional", "Envio")

Rel(user, web, "HTTPS")
Rel(web, api, "JSON /v1", "HTTPS + cookies/sessão")
Rel(api, db, "Prisma / TCP TLS")
Rel(api, stripe, "Webhooks + API", "HTTPS")
Rel(api, s3, "SDK S3", "HTTPS")
Rel(api, smtp, "Envio", "TLS")
```

Checkout direto do usuário ao Stripe (portal self-service) fica para fase posterior; no M0 a cobrança é orientada por webhooks e estado espelhado na API.

### Notas

- **Worker assíncrono** não aparece no M0 mínimo; webhooks Stripe podem ser tratados na própria API com fila interna ou endpoint dedicado com timeout alto. Se a carga exigir, um contêiner **Worker** será adicionado por ADR posterior.
- **Motores de domínio** (importação, parcelas) não são contêineres no M0 — permanecem fora do diagrama até M2/M3.
