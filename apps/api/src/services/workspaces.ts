import type { Workspace, WorkspaceKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { appendAudit } from "./audit.js";
import { countActiveWorkspaces, loadWorkspaceInOrg } from "../lib/workspace-scope.js";

export async function listWorkspaces(organizationId: string): Promise<Workspace[]> {
  return prisma.workspace.findMany({
    where: { organizationId },
    orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function createWorkspace(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  kind: WorkspaceKind;
}): Promise<Workspace> {
  const active = await countActiveWorkspaces(input.organizationId);
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!subscription) {
    throw Object.assign(new Error("Assinatura não encontrada."), { code: "no_subscription" });
  }
  const ent = await prisma.planEntitlement.findUnique({
    where: { planCode: subscription.planCode },
  });
  if (!ent) {
    throw Object.assign(new Error(`Plano desconhecido: ${subscription.planCode}`), {
      code: "unknown_plan",
    });
  }
  if (active >= ent.maxWorkspaces) {
    const err = new Error("Limite de workspaces do plano excedido.");
    Object.assign(err, { code: "workspace_limit_exceeded" });
    throw err;
  }

  const ws = await prisma.workspace.create({
    data: {
      organizationId: input.organizationId,
      kind: input.kind,
      name: input.name.trim(),
    },
  });

  await appendAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "workspace.create",
    resourceType: "workspace",
    resourceId: ws.id,
    metadata: {
      organizationId: input.organizationId,
      workspaceId: ws.id,
      kind: ws.kind,
      name: ws.name,
    },
  });

  return ws;
}

export async function patchWorkspace(input: {
  organizationId: string;
  actorUserId: string;
  workspaceId: string;
  name?: string;
  archive?: boolean;
}): Promise<Workspace | null> {
  const existing = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!existing) {
    return null;
  }

  const data: { name?: string; archivedAt?: Date | null } = {};
  if (typeof input.name === "string") {
    data.name = input.name.trim();
  }
  if (input.archive === true) {
    data.archivedAt = existing.archivedAt ?? new Date();
  }

  if (Object.keys(data).length === 0) {
    return existing;
  }

  const updated = await prisma.workspace.update({
    where: { id: existing.id },
    data,
  });

  const action = input.archive === true ? "workspace.archive" : "workspace.update";
  await appendAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action,
    resourceType: "workspace",
    resourceId: updated.id,
    metadata: {
      organizationId: input.organizationId,
      workspaceId: updated.id,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(input.archive === true ? { archived: true } : {}),
    },
  });

  return updated;
}
