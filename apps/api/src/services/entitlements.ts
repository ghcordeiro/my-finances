import { prisma } from "../lib/prisma.js";

export type EntitlementMetric = "max_workspaces";

export class EntitlementExceededError extends Error {
  readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "EntitlementExceededError";
  }
}

export async function assertWithinEntitlement(
  organizationId: string,
  metric: EntitlementMetric,
  currentCount: number,
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });
  if (!subscription) {
    throw new EntitlementExceededError("Assinatura não encontrada para a organização.");
  }

  const ent = await prisma.planEntitlement.findUnique({
    where: { planCode: subscription.planCode },
  });
  if (!ent) {
    throw new EntitlementExceededError(`Plano desconhecido: ${subscription.planCode}`);
  }

  if (metric === "max_workspaces") {
    if (currentCount >= ent.maxWorkspaces) {
      throw new EntitlementExceededError("Limite de workspaces do plano excedido.");
    }
  }
}
