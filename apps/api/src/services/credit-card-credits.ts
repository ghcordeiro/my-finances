import { Prisma } from "@prisma/client";
import { billingAsOf } from "../lib/billing-as-of.js";
import { TxAbort } from "../lib/tx-abort.js";
import { withSerializableRetry } from "../lib/serializable-retry.js";
import { appendAuditTx } from "./audit.js";
import { ensureStatementsCurrent } from "./billing-cycle.js";

export type PostCreditInput = {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  cardId: string;
  amount: Prisma.Decimal;
  kind: "refund" | "cashback";
  referencesLineId?: string | null;
  memo?: string | null;
  postedAt?: Date | null;
};

export type PostCreditError =
  | "workspace_not_found"
  | "card_not_found"
  | "card_archived"
  | "workspace_archived"
  | "line_not_found"
  | "validation_error";

export async function postCredit(
  input: PostCreditInput,
): Promise<{ ok: true } | { ok: false; error: PostCreditError }> {
  if (!input.amount.gt(0)) {
    return { ok: false, error: "validation_error" };
  }
  if (input.kind === "refund" && !input.referencesLineId) {
    return { ok: false, error: "validation_error" };
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

    await ensureStatementsCurrent(tx, card, billingAsOf());

    const postedAt = input.postedAt ?? billingAsOf();
    const signed = new Prisma.Decimal(0).sub(input.amount);

    let statementId: string | null = null;
    if (input.referencesLineId) {
      const ref = await tx.creditCardStatementLine.findFirst({
        where: {
          id: input.referencesLineId,
          organizationId: input.organizationId,
          statement: { creditCardId: card.id },
        },
        include: { statement: true },
      });
      if (!ref) {
        throw new TxAbort("linha", "line_not_found");
      }
      if (!ref.amount.gt(0)) {
        throw new TxAbort("linha", "validation_error");
      }
      const already = await tx.creditCardStatementLine.aggregate({
        where: {
          referencesLineId: ref.id,
          lineKind: "credit",
        },
        _sum: { amount: true },
      });
      const creditedNeg = already._sum.amount ?? new Prisma.Decimal(0);
      const credited = creditedNeg.abs();
      if (credited.add(input.amount).gt(ref.amount)) {
        throw new TxAbort("parcial", "validation_error");
      }
      statementId = ref.statementId;
    } else {
      const openSt = await tx.creditCardStatement.findFirst({
        where: { creditCardId: card.id, status: "open" },
      });
      if (!openSt) {
        throw new TxAbort("sem open", "validation_error");
      }
      statementId = openSt.id;
    }

    await tx.creditCardStatementLine.create({
      data: {
        organizationId: input.organizationId,
        statementId: statementId!,
        lineKind: "credit",
        amount: signed,
        postedAt,
        memo: input.memo?.trim() || null,
        referencesLineId: input.referencesLineId ?? null,
      },
    });

    await appendAuditTx(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "credit_card_line.create",
      resourceType: "credit_card_line",
      resourceId: card.id,
      metadata: { creditCardId: card.id, kind: input.kind },
    });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof TxAbort) {
      return { ok: false, error: e.code as PostCreditError };
    }
    throw e;
  }
}
