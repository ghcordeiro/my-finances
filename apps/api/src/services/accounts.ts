import type { Account, AccountType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { appendAudit } from "./audit.js";
import { loadWorkspaceInOrg } from "../lib/workspace-scope.js";

function decimalString(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

async function computeBalancesForAccounts(
  accounts: Account[],
): Promise<Map<string, Prisma.Decimal>> {
  const ids = accounts.map((a) => a.id);
  const balances = new Map<string, Prisma.Decimal>();
  for (const a of accounts) {
    balances.set(a.id, new Prisma.Decimal(a.initialBalance));
  }
  if (ids.length === 0) {
    return balances;
  }
  const transfers = await prisma.transfer.findMany({
    where: {
      OR: [{ fromAccountId: { in: ids } }, { toAccountId: { in: ids } }],
    },
  });
  for (const t of transfers) {
    const amt = new Prisma.Decimal(t.amount);
    const from = balances.get(t.fromAccountId);
    const to = balances.get(t.toAccountId);
    if (from) balances.set(t.fromAccountId, from.sub(amt));
    if (to) balances.set(t.toAccountId, to.add(amt));
  }

  const postingSums = await prisma.accountImportPosting.groupBy({
    by: ["accountId"],
    where: { accountId: { in: ids } },
    _sum: { amount: true },
  });
  for (const row of postingSums) {
    const cur = balances.get(row.accountId);
    const add = row._sum.amount ? new Prisma.Decimal(row._sum.amount) : new Prisma.Decimal(0);
    if (cur) balances.set(row.accountId, cur.add(add));
  }

  return balances;
}

export type AccountWithBalance = Account & { currentBalance: string };

export async function listAccountsForWorkspace(input: {
  organizationId: string;
  workspaceId: string;
}): Promise<{ workspaceArchived: boolean; accounts: AccountWithBalance[] } | null> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) {
    return null;
  }
  const rows = await prisma.account.findMany({
    where: { organizationId: input.organizationId, workspaceId: input.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  const bal = await computeBalancesForAccounts(rows);
  return {
    workspaceArchived: ws.archivedAt !== null,
    accounts: rows.map((a) => ({
      ...a,
      currentBalance: decimalString(bal.get(a.id) ?? new Prisma.Decimal(0)),
    })),
  };
}

export async function createAccount(input: {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  name: string;
  type: AccountType;
  currency?: string;
  initialBalance?: Prisma.Decimal | string | number;
}): Promise<{ ok: true; account: Account } | { ok: false; reason: "workspace_not_found" | "workspace_archived" }> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) {
    return { ok: false, reason: "workspace_not_found" };
  }
  if (ws.archivedAt) {
    return { ok: false, reason: "workspace_archived" };
  }

  const initial =
    input.initialBalance !== undefined
      ? new Prisma.Decimal(input.initialBalance.toString())
      : new Prisma.Decimal(0);
  if (initial.lt(0)) {
    throw Object.assign(new Error("Saldo inicial inválido."), { code: "invalid_initial_balance" });
  }

  const account = await prisma.account.create({
    data: {
      organizationId: input.organizationId,
      workspaceId: ws.id,
      name: input.name.trim(),
      type: input.type,
      currency: (input.currency ?? "BRL").trim().toUpperCase(),
      initialBalance: initial,
    },
  });

  await appendAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "account.create",
    resourceType: "account",
    resourceId: account.id,
    metadata: {
      organizationId: input.organizationId,
      workspaceId: ws.id,
      accountId: account.id,
      name: account.name,
      type: account.type,
    },
  });

  return { ok: true, account };
}

export async function patchAccount(input: {
  organizationId: string;
  workspaceId: string;
  accountId: string;
  actorUserId: string;
  name?: string;
  archive?: boolean;
}): Promise<
  | { ok: true; account: Account }
  | { ok: false; reason: "workspace_not_found" | "account_not_found" }
> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) {
    return { ok: false, reason: "workspace_not_found" };
  }
  const acc = await prisma.account.findFirst({
    where: {
      id: input.accountId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    },
  });
  if (!acc) {
    return { ok: false, reason: "account_not_found" };
  }

  const data: { name?: string; archivedAt?: Date | null } = {};
  if (typeof input.name === "string") {
    data.name = input.name.trim();
  }
  if (input.archive === true) {
    data.archivedAt = acc.archivedAt ?? new Date();
  }
  if (Object.keys(data).length === 0) {
    return { ok: true, account: acc };
  }

  const updated = await prisma.account.update({
    where: { id: acc.id },
    data,
  });

  const action = input.archive === true ? "account.archive" : "account.update";
  await appendAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action,
    resourceType: "account",
    resourceId: updated.id,
    metadata: {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      accountId: updated.id,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(input.archive === true ? { archived: true } : {}),
    },
  });

  return { ok: true, account: updated };
}
