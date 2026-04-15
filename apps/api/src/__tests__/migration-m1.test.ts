import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { resetAppTables } from "./test-db.js";

/**
 * Smoke de schema M1 (workspaces, accounts, transfers) + backfill retro.
 * Rastreio: M1-T-001, Fix 7 da auditoria 2026-04-15.
 */

const BACKFILL_SQL = `
  INSERT INTO workspaces (id, organization_id, kind, name, created_at, updated_at)
  SELECT gen_random_uuid(), o.id, 'personal', 'Pessoal', now(), now()
  FROM organizations o
  LEFT JOIN workspaces w ON w.organization_id = o.id
  WHERE w.id IS NULL;
`;

async function countWorkspacesForOrg(orgId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM workspaces WHERE organization_id = $1`,
    orgId,
  );
  return Number(rows[0]?.count ?? 0);
}

describe("M1-T-001 schema M1 + backfill retro", () => {
  beforeEach(async () => {
    await resetAppTables();
  });

  afterEach(async () => {
    await resetAppTables();
  });

  it("novas tabelas respondem a findMany (schema presente)", async () => {
    const [workspaces, accounts, transfers] = await Promise.all([
      prisma.workspace.findMany(),
      prisma.account.findMany(),
      prisma.transfer.findMany(),
    ]);
    expect(Array.isArray(workspaces)).toBe(true);
    expect(Array.isArray(accounts)).toBe(true);
    expect(Array.isArray(transfers)).toBe(true);
  });

  it("backfill SQL cria exatamente um workspace personal para org sem workspace e é idempotente", async () => {
    const org = await prisma.organization.create({
      data: { name: "Org legada pré-M1" },
    });

    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    expect(await countWorkspacesForOrg(org.id)).toBe(1);

    const first = await prisma.workspace.findFirstOrThrow({
      where: { organizationId: org.id },
    });
    expect(first.kind).toBe("personal");
    expect(first.archivedAt).toBeNull();
    expect(first.name.length).toBeGreaterThan(0);

    await prisma.$executeRawUnsafe(BACKFILL_SQL);
    expect(await countWorkspacesForOrg(org.id)).toBe(1);
  });

  it("invariante: toda organization tem pelo menos um workspace após backfill", async () => {
    await prisma.organization.createMany({
      data: [
        { name: "Org A sem workspace" },
        { name: "Org B sem workspace" },
        { name: "Org C sem workspace" },
      ],
    });

    await prisma.$executeRawUnsafe(BACKFILL_SQL);

    const orphans = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count
       FROM organizations o
       LEFT JOIN workspaces w ON w.organization_id = o.id
       WHERE w.id IS NULL`,
    );
    expect(Number(orphans[0]?.count ?? 0)).toBe(0);
  });
});
