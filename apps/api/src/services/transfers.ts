import type { Transfer, WorkspaceKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { appendAuditTx } from "./audit.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

class TransferValidationError extends Error {
  constructor(readonly transferError: CreateTransferError) {
    super(transferError);
    this.name = "TransferValidationError";
  }
}

function transferKindRule(
  fromKind: WorkspaceKind,
  toKind: WorkspaceKind,
  fromWsId: string,
  toWsId: string,
): true | "transfer_workspace_kind_not_allowed" {
  if (fromWsId === toWsId) {
    return true;
  }
  const okPair =
    (fromKind === "personal" && toKind === "business") ||
    (fromKind === "business" && toKind === "personal");
  return okPair ? true : "transfer_workspace_kind_not_allowed";
}

export type CreateTransferInput = {
  organizationId: string;
  actorUserId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: Prisma.Decimal;
  currency: string;
  bookedAt: Date;
  memo?: string | null;
};

export type CreateTransferError =
  | "account_not_found"
  | "same_account"
  | "account_archived"
  | "currency_mismatch"
  | "invalid_amount"
  | "organization_mismatch"
  | "transfer_workspace_kind_not_allowed";

export async function createTransfer(
  input: CreateTransferInput,
): Promise<{ ok: true; transfer: Transfer } | { ok: false; error: CreateTransferError }> {
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false, error: "same_account" };
  }
  if (input.amount.lte(0)) {
    return { ok: false, error: "invalid_amount" };
  }

  const backoff = [20, 50, 120];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const transfer = await prisma.$transaction(
        async (tx) => {
          const from = await tx.account.findUnique({ where: { id: input.fromAccountId } });
          const to = await tx.account.findUnique({ where: { id: input.toAccountId } });
          if (!from || !to) {
            throw new TransferValidationError("account_not_found");
          }
          if (from.organizationId !== input.organizationId || to.organizationId !== input.organizationId) {
            throw new TransferValidationError("organization_mismatch");
          }
          if (from.archivedAt || to.archivedAt) {
            throw new TransferValidationError("account_archived");
          }
          const cur = input.currency.trim().toUpperCase();
          if (from.currency !== cur || to.currency !== cur) {
            throw new TransferValidationError("currency_mismatch");
          }

          const fromWs = await tx.workspace.findUniqueOrThrow({ where: { id: from.workspaceId } });
          const toWs = await tx.workspace.findUniqueOrThrow({ where: { id: to.workspaceId } });
          if (fromWs.archivedAt || toWs.archivedAt) {
            throw new TransferValidationError("account_archived");
          }

          const rule = transferKindRule(fromWs.kind, toWs.kind, fromWs.id, toWs.id);
          if (rule !== true) {
            throw new TransferValidationError(rule);
          }

          const row = await tx.transfer.create({
            data: {
              organizationId: input.organizationId,
              fromAccountId: from.id,
              toAccountId: to.id,
              amount: input.amount,
              currency: cur,
              bookedAt: input.bookedAt,
              memo: input.memo?.trim() || null,
            },
          });

          await appendAuditTx(tx, {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            action: "transfer.create",
            resourceType: "transfer",
            resourceId: row.id,
            metadata: {
              organizationId: input.organizationId,
              workspaceId: from.workspaceId,
              toWorkspaceId: to.workspaceId,
              fromAccountId: from.id,
              toAccountId: to.id,
              amount: input.amount.toFixed(2),
              currency: cur,
            },
          });

          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10_000 },
      );
      return { ok: true, transfer };
    } catch (e) {
      lastErr = e;
      if (e instanceof TransferValidationError) {
        return { ok: false, error: e.transferError };
      }
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code?: string }).code === "P2034" &&
        attempt < 2
      ) {
        await sleep(backoff[attempt] ?? 120);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function listTransfersForWorkspace(input: {
  organizationId: string;
  workspaceId: string;
}): Promise<Transfer[] | null> {
  const ws = await prisma.workspace.findFirst({
    where: { id: input.workspaceId, organizationId: input.organizationId },
  });
  if (!ws) {
    return null;
  }

  return prisma.transfer.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [
        { fromAccount: { workspaceId: input.workspaceId } },
        { toAccount: { workspaceId: input.workspaceId } },
      ],
    },
    orderBy: [{ bookedAt: "desc" }, { createdAt: "desc" }],
  });
}
