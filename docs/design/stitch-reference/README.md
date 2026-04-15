# Referência de telas — Google Stitch (My Finances)

Este diretório ancora o **layout de referência** gerado no Stitch para o app web (`apps/web`) e para o **Plan/UI** da feature M1 (workspaces, contas, transferências).

**SDD:** índice geral de design em [`../README.md`](../README.md); requisito global `RNF-UI-01` em `.specs/features/product-v1/spec.md`; M1 em `.specs/features/m1-workspaces-core/spec.md` (*Referência de UI*); lei do repositório em `.specs/project/CONSTITUTION.md` §4–§6.

## Projeto no Stitch

| Campo | Valor |
|--------|--------|
| Nome | My Finances Unified Manager |
| ID (`projectId`) | `14496089392956455810` |
| UI Stitch | [stitch.withgoogle.com/projects](https://stitch.withgoogle.com/projects) (abra o projeto na sua conta) |

## Sincronizar HTML e screenshots localmente

1. Crie uma chave em [Stitch → Settings → API Keys](https://stitch.withgoogle.com/settings).
2. Exporte `STITCH_API_KEY` ou adicione em `.env` na raiz do repositório (não commitar a chave).
3. Na raiz do repo:

```bash
export STITCH_API_KEY="sua-chave"
pnpm run design:sync-stitch
```

Isso grava `screens/*.html` (e PNG quando o Stitch expõe `downloadUrl`) e sobrescreve `manifest.json` com títulos e caminhos.

## Telas sincronizadas (último sync)

Referência em `screens/*.html` — alinhar implementação React às mesmas hierarquias e tokens (`DESIGN-SYSTEM.md`).

| Tela (Stitch) | HTML | Rota alvo (sugestão) |
|---------------|------|----------------------|
| Login / Cadastro | `login-cadastro-62d1c676.html` | `/login`, `/register` |
| Gerenciar Workspaces | `gerenciar-workspaces-5f91ef71.html` | `/app/workspaces` (M1) |
| Contas do Workspace | `contas-do-workspace-51108684.html` | `/app/accounts` (M1) |
| Transferências e Fluxos | `transferencias-e-fluxos-1ee9cea3.html` | `/app/transfers` (M1) |
| Configurações da Organização | `configuracoes-da-organizacao-4a0662a2.html` | `/app/settings/organization` |

Metadados canônicos (incl. `screenshotPath` quando existir no disco): ver `manifest.json` (`syncedAt`).

## Uso no desenvolvimento

- **Implementação React**: tokens em `apps/web/src/styles/stitch-tokens.css` e layout em `mf-layout.css`; auth já espelha **Login / Cadastro**.
- **Paridade visual**: abra o HTML de referência no browser ao lado do Vite e compare seção a seção.
- **MCP Cursor**: com `STITCH_API_KEY` no ambiente, use `list_screens` / `get_screen` (`.cursor/mcp.json`).
