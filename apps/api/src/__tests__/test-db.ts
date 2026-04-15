import { prisma } from "../lib/prisma.js";

export async function resetAppTables(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.stripeEventProcessed.deleteMany(),
    prisma.session.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
}
