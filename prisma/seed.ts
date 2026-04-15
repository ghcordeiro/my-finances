import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.planEntitlement.upsert({
    where: { planCode: "trial" },
    create: { planCode: "trial", maxWorkspaces: 2 },
    update: { maxWorkspaces: 2 },
  });
  await prisma.planEntitlement.upsert({
    where: { planCode: "free" },
    create: { planCode: "free", maxWorkspaces: 1 },
    update: { maxWorkspaces: 1 },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
