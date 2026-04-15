# ADR-0005: Faturação e entitlements com Stripe

## Status

Aceito — 2026-04-15

## Contexto

RF-PLT-05 exige entitlements derivados do plano. Precisamos de provedor de pagamento sem reinventar PCI.

## Decisão

- **Stripe** como sistema de verdade para **Customer** e **Subscription** (produto/preço configurados no Dashboard Stripe ou via seed Infrastructure-as-Code).
- Estado espelhado em tabela `subscriptions` atualizado **somente** via **webhooks** assinados + caminho administrativo de sync manual para suporte.
- **Idempotência:** tabela `stripe_events_processed` com `stripe_event_id` UNIQUE; handlers retornam 200 após persistência transacional.
- **M0 stub:** permitir modo `BILLING_PROVIDER=none` em dev que grava `plan_code=trial` sem chamar Stripe, desde que **não** seja habilitado em produção.

## Consequências

**Positivas:** webhooks maduros; portal do cliente Stripe pode ser linkado depois.

**Negativas:** dependência de vendor; testes exigem Stripe CLI ou mocks.

**Alternativas:** Paddle, Mercado Pago — ficam como candidatos se mercado/regulatório exigir; exigiria novo ADR.
