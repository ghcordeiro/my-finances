# Design system de referência — Stitch (“The Digital Vault”)

Resumo do **design theme** do projeto Stitch *My Finances Unified Manager*, para alinhar CSS/React sem depender do HTML exportado.

Índice do pacote de design: [`../README.md`](../README.md). Requisito de produto: `RNF-UI-01` em `.specs/features/product-v1/spec.md`.

## North star

**The Digital Vault:** autoridade silenciosa, calma intelectual, espaço negativo generoso. Evitar fintech “gamificada”. Sensação de escritório de wealth management privado.

## Tipografia

| Uso | Fonte |
|-----|--------|
| Títulos / saldos grandes | **Manrope** (500–700), leve `letter-spacing: -0.02em` em display |
| Corpo, dados, formulários | **Inter** (400–600) |
| Valores em BRL | Inter, `font-variant-numeric: tabular-nums`, alinhamento à direita em tabelas |
| Badges PF / BUSINESS | `label` em caps, `letter-spacing: 0.05em` |

Google Fonts no app: ver `apps/web/index.html`.

## Cores principais (tokens CSS)

| Token Stitch | Hex (referência) | Uso |
|--------------|------------------|-----|
| `surface` | `#f8f9ff` | Fundo da aplicação |
| `surface_container_low` | `#eff4ff` | Seções / blocos |
| `surface_container_lowest` | `#ffffff` | Cards em destaque |
| `primary` / `primary_container` | `#002045` / `#1A365D` | Marca, CTAs em gradiente sugerido 135° |
| `on_surface` | `#0b1c30` | Texto principal |
| `secondary` | `#515f74` | Contexto PF / secundário |
| `tertiary` / `tertiary_fixed` | `#002522` / `#89f5e7` | Contexto PJ / destaque profissional |

Regra **“no-line”**: evitar bordas 1px para seccionar; preferir mudança de tom de `surface*`.

## Componentes assinatura (Stitch)

- **Workspace selector:** “badge” persistente (glass leve), PF vs PJ com imersão tonal distinta.
- **Tabelas:** sem linhas horizontais por padrão; respiro vertical; listras só em alta densidade.
- **Inputs:** fundo `surface_container_highest`; foco com borda “ghost” em `primary` ~40% opacidade.

## Implementação no repo

Variáveis mapeadas em `apps/web/src/styles/stitch-tokens.css`. Layouts auth/shell em `mf-layout.css`.

## Telas exportadas (Stitch → `screens/`)

Após `pnpm run design:sync-stitch`, os HTMLs seguem os títulos do Stitch: **Login / Cadastro**, **Gerenciar Workspaces**, **Contas do Workspace**, **Transferências e Fluxos**, **Configurações da Organização**. Índice e rotas sugeridas: `README.md` e `manifest.json`.
