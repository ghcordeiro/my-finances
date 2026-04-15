import { prisma } from "../lib/prisma.js";

export async function resetAppTables(): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE credit_cards CASCADE`);
  await prisma.$transaction([
    prisma.accountImportPosting.deleteMany(),
    prisma.importBatch.deleteMany(),
    prisma.csvImportTemplate.deleteMany(),
    prisma.transfer.deleteMany(),
    prisma.account.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.stripeEventProcessed.deleteMany(),
    prisma.session.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);
}
