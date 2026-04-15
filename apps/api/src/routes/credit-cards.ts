import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../plugins/require-auth.js";
import { requireOrgContext } from "../plugins/require-org.js";
import { prisma } from "../lib/prisma.js";
import { loadWorkspaceInOrg } from "../lib/workspace-scope.js";
import { appendAuditTx } from "../services/audit.js";
import { getCommittedAmount, markStatementPaid } from "../services/billing-cycle.js";
import { anticipateInstallments } from "../services/credit-card-anticipate.js";
import { postCredit } from "../services/credit-card-credits.js";
import { postPurchase } from "../services/credit-card-purchases.js";
import {
  createCreditCard,
  getCreditCardInWorkspace,
  listCreditCards,
  patchCreditCard,
} from "../services/credit-cards.js";

const createCardBody = z.object({
  name: z.string().min(1).max(120),
  creditLimit: z.union([z.number(), z.string()]),
  currency: z.string().min(3).max(8).optional(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  timezone: z.string().min(1).max(120).optional(),
});

const patchCardBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    creditLimit: z.union([z.number(), z.string()]).optional(),
    closingDay: z.number().int().min(1).max(31).optional(),
    dueDay: z.number().int().min(1).max(31).optional(),
    timezone: z.string().min(1).max(120).optional(),
    archive: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "corpo vazio" });

const purchaseBody = z.object({
  amount: z.union([z.number(), z.string()]),
  purchasedAt: z.string().datetime(),
  installmentCount: z.number().int().min(1),
  memo: z.string().max(500).optional(),
  merchant: z.string().max(500).optional(),
});

const creditBody = z.object({
  amount: z.union([z.number(), z.string()]),
  kind: z.enum(["refund", "cashback"]),
  referencesLineId: z.string().uuid().optional(),
  memo: z.string().max(500).optional(),
  postedAt: z.string().datetime().optional(),
});

const anticipateBody = z.object({
  installmentCount: z.number().int().min(1),
});

const patchStatementBody = z.object({
  status: z.literal("paid"),
});

function dec(v: z.infer<typeof createCardBody>["creditLimit"]): Prisma.Decimal {
  return new Prisma.Decimal(v as string | number);
}

export async function creditCardsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/cards",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const orgId = request.organizationId!;
      const q = request.query as { includeArchived?: string };
      const includeArchived = q.includeArchived === "true";
      const rows = await listCreditCards({
        organizationId: orgId,
        workspaceId: request.params.workspaceId,
        includeArchived,
      });
      if (!rows) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      const out = await Promise.all(
        rows.map(async (c) => {
          const committed = await getCommittedAmount(prisma, orgId, c.id);
          const limit = new Prisma.Decimal(c.creditLimit);
          const rawAvail = limit.sub(committed);
          const available = rawAvail.lt(0) ? new Prisma.Decimal(0) : rawAvail;
          return {
            id: c.id,
            workspaceId: c.workspaceId,
            organizationId: c.organizationId,
            name: c.name,
            currency: c.currency,
            creditLimit: new Prisma.Decimal(c.creditLimit).toFixed(2),
            availableCredit: available.toFixed(2),
            committedAmount: committed.toFixed(2),
            closingDay: c.closingDay,
            dueDay: c.dueDay,
            timezone: c.timezone,
            archivedAt: c.archivedAt?.toISOString() ?? null,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          };
        }),
      );
      await reply.send({ cards: out });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/cards",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = createCardBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const created = await createCreditCard({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        name: parsed.data.name,
        creditLimit: dec(parsed.data.creditLimit),
        currency: parsed.data.currency,
        closingDay: parsed.data.closingDay,
        dueDay: parsed.data.dueDay,
        timezone: parsed.data.timezone,
      });
      if (!created.ok) {
        if (created.reason === "workspace_not_found") {
          await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
          return;
        }
        if (created.reason === "workspace_archived") {
          await reply.status(422).send({ error: "workspace_archived", message: "Workspace arquivado." });
          return;
        }
        await reply.status(400).send({ error: "validation_error" });
        return;
      }
      const c = created.card;
      await reply.status(201).send({
        card: {
          id: c.id,
          workspaceId: c.workspaceId,
          organizationId: c.organizationId,
          name: c.name,
          currency: c.currency,
          creditLimit: new Prisma.Decimal(c.creditLimit).toFixed(2),
          closingDay: c.closingDay,
          dueDay: c.dueDay,
          timezone: c.timezone,
          archivedAt: c.archivedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        },
      });
    },
  );

  app.patch<{ Params: { workspaceId: string; cardId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = patchCardBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const updated = await patchCreditCard({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        cardId: request.params.cardId,
        name: parsed.data.name,
        creditLimit: parsed.data.creditLimit !== undefined ? dec(parsed.data.creditLimit) : undefined,
        closingDay: parsed.data.closingDay,
        dueDay: parsed.data.dueDay,
        timezone: parsed.data.timezone,
        archive: parsed.data.archive,
      });
      if (!updated.ok) {
        if (updated.reason === "workspace_not_found") {
          await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
          return;
        }
        if (updated.reason === "validation_error") {
          await reply.status(400).send({ error: "validation_error" });
          return;
        }
        await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
        return;
      }
      const c = updated.card;
      await reply.send({
        card: {
          id: c.id,
          workspaceId: c.workspaceId,
          organizationId: c.organizationId,
          name: c.name,
          currency: c.currency,
          creditLimit: new Prisma.Decimal(c.creditLimit).toFixed(2),
          closingDay: c.closingDay,
          dueDay: c.dueDay,
          timezone: c.timezone,
          archivedAt: c.archivedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        },
      });
    },
  );

  app.get<{ Params: { workspaceId: string; cardId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId/statements",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const orgId = request.organizationId!;
      const ws = await loadWorkspaceInOrg(orgId, request.params.workspaceId);
      if (!ws) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      const card = await getCreditCardInWorkspace({
        organizationId: orgId,
        workspaceId: request.params.workspaceId,
        cardId: request.params.cardId,
      });
      if (!card) {
        await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
        return;
      }
      const q = request.query as { status?: string; from?: string; to?: string };
      const where: Prisma.CreditCardStatementWhereInput = {
        creditCardId: card.id,
        organizationId: orgId,
      };
      if (q.status === "open" || q.status === "closed" || q.status === "paid" || q.status === "scheduled") {
        where.status = q.status;
      }
      if (q.from) {
        const d = new Date(q.from);
        if (!Number.isNaN(d.getTime())) {
          where.periodEnd = { gte: d };
        }
      }
      if (q.to) {
        const d = new Date(q.to);
        if (!Number.isNaN(d.getTime())) {
          where.periodStart = { lte: d };
        }
      }
      const rows = await prisma.creditCardStatement.findMany({
        where,
        orderBy: { periodEnd: "desc" },
      });
      await reply.send({
        statements: rows.map((s) => ({
          id: s.id,
          creditCardId: s.creditCardId,
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          dueAt: s.dueAt.toISOString(),
          status: s.status,
          closedAt: s.closedAt?.toISOString() ?? null,
          paidAt: s.paidAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
        })),
      });
    },
  );

  app.get<{ Params: { workspaceId: string; cardId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId/statements/current",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const orgId = request.organizationId!;
      const ws = await loadWorkspaceInOrg(orgId, request.params.workspaceId);
      if (!ws) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      const card = await getCreditCardInWorkspace({
        organizationId: orgId,
        workspaceId: request.params.workspaceId,
        cardId: request.params.cardId,
      });
      if (!card) {
        await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
        return;
      }
      const { ensureStatementsCurrent } = await import("../services/billing-cycle.js");
      await prisma.$transaction(async (tx) => {
        await ensureStatementsCurrent(tx, card, undefined);
      });
      const openRow = await prisma.creditCardStatement.findFirst({
        where: { creditCardId: card.id, status: "open" },
      });
      if (!openRow) {
        await reply.status(404).send({ error: "statement_not_found", message: "Sem fatura aberta." });
        return;
      }
      await reply.send({
        statement: {
          id: openRow.id,
          creditCardId: openRow.creditCardId,
          periodStart: openRow.periodStart.toISOString(),
          periodEnd: openRow.periodEnd.toISOString(),
          dueAt: openRow.dueAt.toISOString(),
          status: openRow.status,
          closedAt: openRow.closedAt?.toISOString() ?? null,
          paidAt: openRow.paidAt?.toISOString() ?? null,
          createdAt: openRow.createdAt.toISOString(),
        },
      });
    },
  );

  app.get<{ Params: { workspaceId: string; cardId: string; statementId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId/statements/:statementId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const orgId = request.organizationId!;
      const card = await getCreditCardInWorkspace({
        organizationId: orgId,
        workspaceId: request.params.workspaceId,
        cardId: request.params.cardId,
      });
      if (!card) {
        await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
        return;
      }
      const st = await prisma.creditCardStatement.findFirst({
        where: {
          id: request.params.statementId,
          creditCardId: card.id,
          organizationId: orgId,
        },
        include: { lines: { orderBy: { createdAt: "asc" } } },
      });
      if (!st) {
        await reply.status(404).send({ error: "statement_not_found", message: "Fatura não encontrada." });
        return;
      }
      await reply.send({
        statement: {
          id: st.id,
          creditCardId: st.creditCardId,
          periodStart: st.periodStart.toISOString(),
          periodEnd: st.periodEnd.toISOString(),
          dueAt: st.dueAt.toISOString(),
          status: st.status,
          closedAt: st.closedAt?.toISOString() ?? null,
          paidAt: st.paidAt?.toISOString() ?? null,
          createdAt: st.createdAt.toISOString(),
          lines: st.lines.map((l) => ({
            id: l.id,
            lineKind: l.lineKind,
            amount: new Prisma.Decimal(l.amount).toFixed(2),
            postedAt: l.postedAt.toISOString(),
            memo: l.memo,
            installmentPlanId: l.installmentPlanId,
            installmentIndex: l.installmentIndex,
            referencesLineId: l.referencesLineId,
            metadata: l.metadata,
            createdAt: l.createdAt.toISOString(),
          })),
        },
      });
    },
  );

  app.patch<{ Params: { workspaceId: string; cardId: string; statementId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId/statements/:statementId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = patchStatementBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const orgId = request.organizationId!;
      const card = await getCreditCardInWorkspace({
        organizationId: orgId,
        workspaceId: request.params.workspaceId,
        cardId: request.params.cardId,
      });
      if (!card) {
        await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
        return;
      }
      const res = await prisma.$transaction(async (tx) => {
        const r = await markStatementPaid(tx, {
          organizationId: orgId,
          creditCardId: card.id,
          statementId: request.params.statementId,
        });
        if (r === "updated") {
          await appendAuditTx(tx, {
            organizationId: orgId,
            actorUserId: request.sessionUserId!,
            action: "credit_card_statement.pay",
            resourceType: "credit_card_statement",
            resourceId: request.params.statementId,
            metadata: { creditCardId: card.id },
          });
        }
        return r;
      });
      if (res === "statement_not_found") {
        await reply.status(404).send({ error: "statement_not_found", message: "Fatura não encontrada." });
        return;
      }
      if (res === "statement_not_mutable") {
        await reply.status(422).send({ error: "statement_not_mutable", message: "Fatura não pode ser paga neste estado." });
        return;
      }
      await reply.send({ ok: true });
    },
  );

  app.post<{ Params: { workspaceId: string; cardId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId/purchases",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = purchaseBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const res = await postPurchase({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        cardId: request.params.cardId,
        amount: dec(parsed.data.amount),
        purchasedAt: new Date(parsed.data.purchasedAt),
        installmentCount: parsed.data.installmentCount,
        memo: parsed.data.memo,
        merchant: parsed.data.merchant,
      });
      if (!res.ok) {
        if (res.error === "workspace_not_found") {
          await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
          return;
        }
        if (res.error === "card_not_found") {
          await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
          return;
        }
        if (res.error === "card_archived") {
          await reply.status(422).send({ error: "card_archived", message: "Cartão arquivado." });
          return;
        }
        if (res.error === "workspace_archived") {
          await reply.status(422).send({ error: "workspace_archived", message: "Workspace arquivado." });
          return;
        }
        if (res.error === "credit_limit_exceeded") {
          await reply.status(409).send({ error: "credit_limit_exceeded", message: "Limite excedido." });
          return;
        }
        await reply.status(400).send({ error: "validation_error" });
        return;
      }
      await reply.status(201).send({ ok: true, installmentPlanId: res.planId });
    },
  );

  app.post<{ Params: { workspaceId: string; cardId: string; planId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId/installment-plans/:planId/anticipate",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = anticipateBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const res = await anticipateInstallments({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        cardId: request.params.cardId,
        planId: request.params.planId,
        installmentCount: parsed.data.installmentCount,
      });
      if (!res.ok) {
        if (res.error === "workspace_not_found") {
          await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
          return;
        }
        if (res.error === "card_not_found") {
          await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
          return;
        }
        if (res.error === "plan_not_found") {
          await reply.status(404).send({ error: "installment_plan_not_found", message: "Plano não encontrado." });
          return;
        }
        if (res.error === "anticipation_invalid") {
          await reply.status(422).send({ error: "anticipation_invalid", message: "Antecipação inválida." });
          return;
        }
        if (res.error === "card_archived" || res.error === "workspace_archived") {
          await reply.status(422).send({ error: res.error, message: "Operação não permitida." });
          return;
        }
      }
      await reply.status(201).send({ ok: true });
    },
  );

  app.post<{ Params: { workspaceId: string; cardId: string } }>(
    "/workspaces/:workspaceId/cards/:cardId/credits",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = creditBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const res = await postCredit({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        cardId: request.params.cardId,
        amount: dec(parsed.data.amount),
        kind: parsed.data.kind,
        referencesLineId: parsed.data.referencesLineId,
        memo: parsed.data.memo,
        postedAt: parsed.data.postedAt ? new Date(parsed.data.postedAt) : null,
      });
      if (!res.ok) {
        if (res.error === "workspace_not_found") {
          await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
          return;
        }
        if (res.error === "card_not_found") {
          await reply.status(404).send({ error: "card_not_found", message: "Cartão não encontrado." });
          return;
        }
        if (res.error === "line_not_found") {
          await reply.status(404).send({ error: "line_not_found", message: "Linha não encontrada." });
          return;
        }
        if (res.error === "card_archived" || res.error === "workspace_archived") {
          await reply.status(422).send({ error: res.error, message: "Operação não permitida." });
          return;
        }
        await reply.status(422).send({ error: "validation_error", message: "Crédito inválido." });
        return;
      }
      await reply.status(201).send({ ok: true });
    },
  );
}
