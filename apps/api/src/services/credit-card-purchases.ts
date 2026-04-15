import { Prisma } from "@prisma/client";
import { billingAsOf } from "../lib/billing-as-of.js";
import { TxAbort } from "../lib/tx-abort.js";
import { withSerializableRetry } from "../lib/serializable-retry.js";
import { appendAuditTx } from "./audit.js";
import {
  computeInstallmentAmounts,
  ensureScheduledStatementForPeriodEnd,
  ensureStatementsCurrent,
  getCommittedAmount,
  installmentStatementEnds,
} from "./billing-cycle.js";

export type PostPurchaseInput = {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  cardId: string;
  amount: Prisma.Decimal;
  purchasedAt: Date;
  installmentCount: number;
  memo?: string | null;
  merchant?: string | null;
};

export type PostPurchaseError =
  | "workspace_not_found"
  | "card_not_found"
  | "card_archived"
  | "workspace_archived"
  | "credit_limit_exceeded"
  | "validation_error";

export async function postPurchase(
  input: PostPurchaseInput,
): Promise<{ ok: true; planId: string | null } | { ok: false; error: PostPurchaseError }> {
  if (input.amount.lte(0) || !Number.isInteger(input.installmentCount) || input.installmentCount < 1) {
    return { ok: false, error: "validation_error" };
  }

  try {
    return await withSerializableRetry(async (tx) => {
    const card = await tx.creditCard.findFirst({
      where: {
        id: input.cardId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
      },
      include: { workspace: true },
    });
    if (!card) {
      const ws = await tx.workspace.findFirst({
        where: { id: input.workspaceId, organizationId: input.organizationId },
      });
      throw new TxAbort("not found", ws ? "card_not_found" : "workspace_not_found");
    }
    if (card.archivedAt) {
      throw new TxAbort("arquivado", "card_archived");
    }
    if (card.workspace.archivedAt) {
      throw new TxAbort("workspace arquivado", "workspace_archived");
    }

    const asOf = new Date(Math.max(input.purchasedAt.getTime(), billingAsOf().getTime()));
    await ensureStatementsCurrent(tx, card, asOf);

    const committed = await getCommittedAmount(tx, input.organizationId, card.id);
    if (committed.add(input.amount).gt(card.creditLimit)) {
      throw new TxAbort("limite", "credit_limit_exceeded");
    }

    const ends = installmentStatementEnds(
      input.purchasedAt,
      input.installmentCount,
      card.closingDay,
      card.timezone,
    );
    const amounts = computeInstallmentAmounts(input.amount, input.installmentCount);

    if (input.installmentCount === 1) {
      const openSt = await tx.creditCardStatement.findFirstOrThrow({
        where: { creditCardId: card.id, status: "open" },
      });
      const line = await tx.creditCardStatementLine.create({
        data: {
          organizationId: input.organizationId,
          statementId: openSt.id,
          lineKind: "purchase",
          amount: amounts[0]!,
          postedAt: input.purchasedAt,
          memo: input.memo?.trim() || null,
        },
      });
      await appendAuditTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "credit_card_line.create",
        resourceType: "credit_card_line",
        resourceId: line.id,
        metadata: { creditCardId: card.id, kind: "purchase" },
      });
      return { ok: true, planId: null };
    }

    const plan = await tx.installmentPlan.create({
        data: {
          organizationId: input.organizationId,
          creditCardId: card.id,
          purchaseAmount: input.amount,
          installmentCount: input.installmentCount,
          purchasedAt: input.purchasedAt,
          merchantDescription: input.merchant?.trim() || null,
        },
      });
      for (let i = 0; i < input.installmentCount; i++) {
        const st = await ensureScheduledStatementForPeriodEnd(tx, card, ends[i]!);
        await tx.creditCardStatementLine.create({
          data: {
            organizationId: input.organizationId,
            statementId: st.id,
            lineKind: "installment",
            amount: amounts[i]!,
            postedAt: input.purchasedAt,
            memo: input.memo?.trim() || null,
            installmentPlanId: plan.id,
            installmentIndex: i + 1,
          },
        });
      }
      await appendAuditTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "installment_plan.create",
        resourceType: "installment_plan",
        resourceId: plan.id,
        metadata: { creditCardId: card.id, installmentCount: input.installmentCount },
      });
      await appendAuditTx(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: "credit_card_line.create",
        resourceType: "credit_card_line",
        resourceId: plan.id,
        metadata: { creditCardId: card.id, kind: "installment_purchase" },
      });
    return { ok: true, planId: plan.id };
    });
  } catch (e) {
    if (e instanceof TxAbort) {
      return { ok: false, error: e.code as PostPurchaseError };
    }
    throw e;
  }
}
