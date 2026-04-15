import type { Workspace } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function loadWorkspaceInOrg(
  organizationId: string,
  workspaceId: string,
): Promise<Workspace | null> {
  return prisma.workspace.findFirst({
    where: { id: workspaceId, organizationId },
  });
}

export async function countActiveWorkspaces(organizationId: string): Promise<number> {
  return prisma.workspace.count({
    where: { organizationId, archivedAt: null },
  });
}
