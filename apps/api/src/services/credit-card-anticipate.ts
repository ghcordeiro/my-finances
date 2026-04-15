import { Prisma } from "@prisma/client";
import { billingAsOf } from "../lib/billing-as-of.js";
import { TxAbort } from "../lib/tx-abort.js";
import { withSerializableRetry } from "../lib/serializable-retry.js";
import { appendAuditTx } from "./audit.js";
import { ensureStatementsCurrent } from "./billing-cycle.js";

export type AnticipateInput = {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  cardId: string;
  planId: string;
  installmentCount: number;
};

export type AnticipateError =
  | "workspace_not_found"
  | "card_not_found"
  | "card_archived"
  | "workspace_archived"
  | "plan_not_found"
  | "anticipation_invalid";

export async function anticipateInstallments(
  input: AnticipateInput,
): Promise<{ ok: true } | { ok: false; error: AnticipateError }> {
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1) {
    return { ok: false, error: "anticipation_invalid" };
  }

  try {
    await withSerializableRetry(async (tx) => {
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

    const plan = await tx.installmentPlan.findFirst({
      where: { id: input.planId, creditCardId: card.id, organizationId: input.organizationId },
    });
    if (!plan) {
      throw new TxAbort("plano", "plan_not_found");
    }

    await ensureStatementsCurrent(tx, card, billingAsOf());

    const lines = await tx.creditCardStatementLine.findMany({
      where: { installmentPlanId: plan.id, lineKind: "installment" },
      orderBy: { installmentIndex: "asc" },
    });
    const pending = lines.filter((l) => l.amount.gt(0));
    if (pending.length === 0 || input.installmentCount > pending.length) {
      throw new TxAbort("K inválido", "anticipation_invalid");
    }

    const victims = pending.slice(0, input.installmentCount);
    let freed = new Prisma.Decimal(0);
    for (const v of victims) {
      freed = freed.add(v.amount);
      await tx.creditCardStatementLine.delete({ where: { id: v.id } });
    }

    const openSt = await tx.creditCardStatement.findFirstOrThrow({
      where: { creditCardId: card.id, status: "open" },
    });

    await tx.creditCardStatementLine.create({
      data: {
        organizationId: input.organizationId,
        statementId: openSt.id,
        lineKind: "adjustment",
        amount: new Prisma.Decimal(0).sub(freed),
        postedAt: billingAsOf(),
        memo: "antecipação de parcelas",
        installmentPlanId: plan.id,
        metadata: { anticipatedInstallmentCount: input.installmentCount },
      },
    });

    await appendAuditTx(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "installment_plan.anticipate",
      resourceType: "installment_plan",
      resourceId: plan.id,
      metadata: { creditCardId: card.id, installmentCount: input.installmentCount },
    });

    });
    return { ok: true };
  } catch (e) {
    if (e instanceof TxAbort) {
      return { ok: false, error: e.code as AnticipateError };
    }
    throw e;
  }
}
