# ADR-0002: Autenticação e sessão (M0)

## Status

Aceito — 2026-04-15

## Contexto

RF-PLT-03 exige autenticação de usuários humanos. Gray area do spec: e-mail/senha vs. OIDC enterprise. Para M0 precisamos shippar algo suportável sem vendor lock-in obrigatório.

## Decisão

- **Credenciais:** e-mail + senha no M0.
- **Hash de senha:** Argon2id com parâmetros conservadores (ajustáveis por env).
- **Sessão:** cookie HTTP-only **signed** ou opaco apontando para registro em `sessions` (token aleatório hasheado armazenado, expiração, rotação em login). Preferência: **sessão opaca em DB** para revogação simples e invalidação no logout.
- **Verificação de e-mail:** fluxo obrigatório antes de operações sensíveis (criar segunda org, billing); pode ser “soft” no primeiro dia com feature flag documentada se necessário para MVP interno.
- **OIDC / social:** explicitamente **fora do M0**, entrada em roadmap pós-M1 quando houver necessidade enterprise.

## Consequências

**Positivas:** controle total; sem custo por MAU de IdP terceiro no início.

**Negativas:** manutenção de fluxos de reset, templates de e-mail, proteção contra credential stuffing — exigem disciplina e rate limits.

## Notas

Se mais tarde adotarmos Clerk/Auth0/Cognito, este ADR deve ser **substituído** ou complementado por ADR de migração de identidade; até lá, usuários vivem na tabela `users` local.
