import type { CreditCard } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { loadWorkspaceInOrg } from "../lib/workspace-scope.js";
import { appendAuditTx } from "./audit.js";
import { createInitialOpenStatement } from "./billing-cycle.js";

export type CreateCreditCardInput = {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  name: string;
  creditLimit: Prisma.Decimal;
  currency?: string;
  closingDay: number;
  dueDay: number;
  timezone?: string;
};

export type PatchCreditCardInput = {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  cardId: string;
  name?: string;
  creditLimit?: Prisma.Decimal;
  closingDay?: number;
  dueDay?: number;
  timezone?: string;
  archive?: boolean;
};

function validateDays(d: number): boolean {
  return Number.isInteger(d) && d >= 1 && d <= 31;
}

export async function createCreditCard(
  input: CreateCreditCardInput,
): Promise<
  | { ok: true; card: CreditCard }
  | { ok: false; reason: "workspace_not_found" | "workspace_archived" | "validation_error" }
> {
  if (!validateDays(input.closingDay) || !validateDays(input.dueDay)) {
    return { ok: false, reason: "validation_error" };
  }
  if (input.creditLimit.lt(0)) {
    return { ok: false, reason: "validation_error" };
  }
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) {
    return { ok: false, reason: "workspace_not_found" };
  }
  if (ws.archivedAt) {
    return { ok: false, reason: "workspace_archived" };
  }
  const tz = (input.timezone?.trim() || "America/Sao_Paulo").slice(0, 120);
  const cur = (input.currency?.trim() || "BRL").toUpperCase();

  const card = await prisma.$transaction(async (tx) => {
    const row = await tx.creditCard.create({
      data: {
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        name: input.name.trim(),
        currency: cur,
        creditLimit: input.creditLimit,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        timezone: tz,
      },
    });
    await createInitialOpenStatement(tx, row);
    await appendAuditTx(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "credit_card.create",
      resourceType: "credit_card",
      resourceId: row.id,
      metadata: {
        workspaceId: input.workspaceId,
        creditCardId: row.id,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
      },
    });
    return row;
  });

  return { ok: true, card };
}

export async function listCreditCards(input: {
  organizationId: string;
  workspaceId: string;
  includeArchived?: boolean;
}): Promise<CreditCard[] | null> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) {
    return null;
  }
  return prisma.creditCard.findMany({
    where: {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      archivedAt: input.includeArchived ? undefined : null,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCreditCardInWorkspace(input: {
  organizationId: string;
  workspaceId: string;
  cardId: string;
}): Promise<CreditCard | null> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) {
    return null;
  }
  return prisma.creditCard.findFirst({
    where: {
      id: input.cardId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    },
  });
}

export async function patchCreditCard(
  input: PatchCreditCardInput,
): Promise<
  | { ok: true; card: CreditCard }
  | { ok: false; reason: "workspace_not_found" | "card_not_found" | "validation_error" }
> {
  const existing = await getCreditCardInWorkspace({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    cardId: input.cardId,
  });
  if (!existing) {
    const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
    return { ok: false, reason: ws ? "card_not_found" : "workspace_not_found" };
  }
  if (
    (input.closingDay !== undefined && !validateDays(input.closingDay)) ||
    (input.dueDay !== undefined && !validateDays(input.dueDay))
  ) {
    return { ok: false, reason: "validation_error" };
  }
  if (input.creditLimit !== undefined && input.creditLimit.lt(0)) {
    return { ok: false, reason: "validation_error" };
  }

  const card = await prisma.$transaction(async (tx) => {
    const row = await tx.creditCard.update({
      where: { id: existing.id },
      data: {
        name: input.name?.trim(),
        creditLimit: input.creditLimit,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        timezone: input.timezone?.trim(),
        archivedAt: input.archive === true ? new Date() : input.archive === false ? null : undefined,
      },
    });
    await appendAuditTx(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "credit_card.update",
      resourceType: "credit_card",
      resourceId: row.id,
      metadata: { workspaceId: input.workspaceId, creditCardId: row.id, archive: input.archive ?? null },
    });
    return row;
  });

  return { ok: true, card };
}
