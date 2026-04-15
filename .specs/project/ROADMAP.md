# ROADMAP — My Finances

Ordem sugerida para reduzir risco. Cada fase pode virar feature SDD (`spec` → `plan` → `tasks` → `implement`).

## M0 — Plataforma SaaS (fundação obrigatória) — **concluído (2026-04-15)**

- **Inquilino (tenant/organização):** modelo de dados, criação no onboarding, limites de plano.
- **Identidade:** cadastro, login, recuperação de senha, sessão ou tokens; verificação de e-mail mínima.
- **Autorização:** papéis (ex.: owner, member, accountant read-only) com escopo por organização e por workspace quando aplicável.
- **Faturação (mínimo):** integração preparada ou stub com um provedor (ex.: Stripe): plano, status de assinatura, webhooks; **entitlements** (limites de workspaces, armazenamento, IA).
- **Observabilidade e auditoria:** logs estruturados, trilha de auditoria para ações sensíveis (export, convite, mudança de plano).
- **Infra:** ambientes, migrações de banco, armazenamento de anexos com prefixo/isolamento por tenant.

*Sem M0 estável, M1+ não é SaaS de verdade — apenas app.*

**Nota de fechamento:** recuperação de senha e verificação de e-mail obrigatória ficam para incremento posterior (ver `STATE.md`). O roadmap textual acima permanece como visão de produto; o rastreio fino está em `tasks.md` + código.

## M1 — Workspaces e núcleo financeiro

- **Workspaces** (PF / PJ) **dentro do tenant**, com isolamento lógico entre workspaces.
- Contas correntes e investimentos; transferências internas e PF ↔ PJ quando permitido pela regra de negócio.
- **UI:** fluxos e hierarquia alinhados ao pacote Stitch em `docs/design/stitch-reference/` (ver `manifest.json` e spec M1).

## M2 — Cartões e motor de faturas

- Cartões por workspace; ciclos; parcelas projetadas; antecipação; estornos/cashbacks.

## M3 — Importação OFX/CSV

- Upload (objeto storage por tenant), templates CSV, deduplicação.

## M4 — Categorização e regras

- Categorias, tags, regras; IA com políticas por tenant (incl. desligar nuvem / BYOK conforme spec).

## M5 — Dashboard e orçamento

- Visão consolidada, drill-down, alertas.

## M6 — Conciliação e auditoria

- Saldo OFX vs. calculado; alertas de furo.

## M7 — Anexos e contabilidade

- Anexos em storage isolado; export PJ; convite contador (read-only) com **auditoria**.

## M8 — API pública e extensibilidade

- API keys por tenant (ou por workspace), rate limit, documentação; preparação para webhooks.

---

**Próximo passo SDD recomendado:** aprovar o **plan** da M1 (`.specs/features/m1-workspaces-core/plan.md` + ADRs `docs/adr/0007`–`0008`), depois redigir **`tasks.md`** e Implement.
