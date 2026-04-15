# ADR-0006: Contexto de organização na API REST

## Status

Aceito — 2026-04-15

## Contexto

RF-PLT-01 e RF-API-01 exigem que toda operação saiba o tenant. Em M0 um usuário tende a ter poucas organizações; ainda assim o servidor deve validar escopo explicitamente.

## Decisão

- Prefixo de API: `/v1`.
- Para rotas que operam em contexto de uma organização:
  - **Cabeçalho obrigatório:** `X-Organization-Id: <uuid>` em todas as rotas autenticadas de domínio (exceto as que listam organizações do usuário).
  - O servidor resolve `membership` para (`user_id`, `organization_id`); se ausente → **403**.
- Listagem `GET /v1/organizations` retorna apenas orgs do usuário; o cliente escolhe e passa o header nas chamadas seguintes.
- **Futuro (M8):** API keys por organização carregarão implicitamente `organization_id` embutido na chave — documentado aqui para não colidir com o modelo de header.

## Consequências

**Positivas:** explícito, fácil de logar e testar; funciona bem com BFF e SPA.

**Negativas:** cliente deve gerenciar org ativa; esquecer header causa 400/403 — mitigado com SDK interno ou interceptors.

**Alternativa rejeitada:** apenas subdomínio `tenant.app.com` no M0 (aumenta complexidade de DNS e certificados cedo demais).
