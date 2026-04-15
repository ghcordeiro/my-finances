# Design — My Finances

Índice do **contrato de interface** alinhado ao fluxo SDD (`.specs/`) e à implementação em `apps/web`.

## Conteúdo

| Artefato | Função |
|----------|--------|
| [`stitch-reference/README.md`](stitch-reference/README.md) | Projeto Stitch, tabela telas → ficheiros HTML/PNG, comando `design:sync-stitch` |
| [`stitch-reference/manifest.json`](stitch-reference/manifest.json) | IDs de tela, `syncedAt`, `appRouteHint` por `screenId` |
| [`stitch-reference/DESIGN-SYSTEM.md`](stitch-reference/DESIGN-SYSTEM.md) | North star (*Digital Vault*), cores, tipografia, regras de componente |
| `stitch-reference/screens/*.html` | Referência pixel/HTML gerada no Stitch (abrir no browser ao implementar) |

## Implementação

- **Tokens e layout base:** `apps/web/src/styles/stitch-tokens.css`, `apps/web/src/styles/mf-layout.css`
- **Fontes:** `apps/web/index.html` (Manrope + Inter)

## Ligação com especificações

- **Constituição:** `.specs/project/CONSTITUTION.md` §4 e §6 — rastreabilidade UI e pacote `docs/design/`.
- **Visão do produto:** `.specs/project/PROJECT.md` — secção *Interface e design*.
- **Requisitos globais:** `.specs/features/product-v1/spec.md` — `RNF-UI-01`.
- **M1 (workspaces / contas / transferências):** `.specs/features/m1-workspaces-core/spec.md` — *Referência de UI (Stitch)*.

Atualize este índice se criar novos documentos sob `docs/design/`.
