# PROJECT — My Finances

## Visão

**SaaS** de gestão financeira **privacy-first** em nuvem: consolidação de extratos e faturas via arquivos (OFX/CSV), workspaces PF/PJ **dentro de cada inquilino**, motor de cartão (parcelas e ciclos), conciliação, categorização e insights. API pública para automações; identidade, isolamento e assinatura fazem parte do núcleo desde o início.

## Objetivos mensuráveis (do PRD)

| Métrica | Meta |
|--------|------|
| Tempo de conciliação por entidade (PF/PJ) | < 15 minutos no fechamento mensal |
| Auto-categorização de importadas | > 90% de acerto |
| Projeção de caixa | ≥ 3 meses à frente (contas a pagar + faturas futuras de cartão) |

## Objetivos de plataforma (SaaS)

| Métrica | Meta (direção) |
|--------|----------------|
| Isolamento entre inquilinos | Zero vazamento cross-tenant em testes de segurança automatizados + revisão manual de queries |
| Disponibilidade | Alvo definido no plano operacional (ex.: 99,5%+), com observabilidade desde o MVP pago |

## Interface e design (web)

- **Contrato visual** versionado em `docs/design/` — ver índice em [`docs/design/README.md`](../../docs/design/README.md).
- Export do **Google Stitch** (HTML/PNG + `manifest.json`) em `docs/design/stitch-reference/`; sincronização: `pnpm run design:sync-stitch` (requer `STITCH_API_KEY`).
- A SPA (`apps/web`) usa tokens e layouts em `src/styles/stitch-tokens.css` e `mf-layout.css`, alinhados ao `DESIGN-SYSTEM.md` do Stitch.

## Fora deste documento

Requisitos detalhados: `.specs/features/product-v1/spec.md`. Marcos: `ROADMAP.md`.

**Marco M0 (plataforma):** concluído em 2026-04-15 — ver `STATE.md` e código em `apps/api`, `apps/web`.

**Marcos M1–M2:** concluídos em 2026-04-15 (workspaces/contas/transferências; cartões e motor de faturas). **Marco M3 (importação OFX/CSV):** **Plan aprovado** (2026-04-15); **`tasks.md` redigido** (rascunho) — aguarda aprovação gate Tasks → Implement; ver `.specs/features/m3-import-ofx-csv/`.
