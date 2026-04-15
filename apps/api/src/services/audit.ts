import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type AppendAuditInput = {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

function auditCreateData(input: AppendAuditInput) {
  return {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? undefined,
  };
}

export async function appendAudit(input: AppendAuditInput): Promise<void> {
  await prisma.auditLog.create({ data: auditCreateData(input) });
}

/** Auditoria dentro da mesma transação Prisma (ex.: transferência M1). */
export async function appendAuditTx(
  tx: Prisma.TransactionClient,
  input: AppendAuditInput,
): Promise<void> {
  await tx.auditLog.create({ data: auditCreateData(input) });
}
