import { describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";

describe("T-TEST-002 migração M0", () => {
  it("modelos vazios respondem a findMany", async () => {
    const [
      users,
      organizations,
      memberships,
      sessions,
      subscriptions,
      auditLogs,
      stripeEvents,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.organization.findMany(),
      prisma.membership.findMany(),
      prisma.session.findMany(),
      prisma.subscription.findMany(),
      prisma.auditLog.findMany(),
      prisma.stripeEventProcessed.findMany(),
    ]);
    expect(Array.isArray(users)).toBe(true);
    expect(Array.isArray(organizations)).toBe(true);
    expect(Array.isArray(memberships)).toBe(true);
    expect(Array.isArray(sessions)).toBe(true);
    expect(Array.isArray(subscriptions)).toBe(true);
    expect(Array.isArray(auditLogs)).toBe(true);
    expect(Array.isArray(stripeEvents)).toBe(true);
  });
});

/** M3-T-001 — smoke schema M3 (ADR-0011, migração parcial única). */
describe("M3-T-001 migração M3 import OFX/CSV", () => {
  it("modelos M3 respondem a findMany", async () => {
    const [templates, batches, postings] = await Promise.all([
      prisma.csvImportTemplate.findMany(),
      prisma.importBatch.findMany(),
      prisma.accountImportPosting.findMany(),
    ]);
    expect(Array.isArray(templates)).toBe(true);
    expect(Array.isArray(batches)).toBe(true);
    expect(Array.isArray(postings)).toBe(true);
  });

  it("enum ImportBatchStatus e índices únicos parciais existem no Postgres", async () => {
    const enumRows = await prisma.$queryRaw<{ typname: string }[]>`
      SELECT typname::text FROM pg_type WHERE typname = 'ImportBatchStatus'
    `;
    expect(enumRows.length).toBe(1);

    const partialIndexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname::text
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'csv_import_templates_org_workspace_name_key',
          'import_batches_workspace_account_sha_completed_partial',
          'account_import_postings_account_external_partial'
        )
      ORDER BY indexname
    `;
    expect(partialIndexes.map((r) => r.indexname)).toEqual([
      "account_import_postings_account_external_partial",
      "csv_import_templates_org_workspace_name_key",
      "import_batches_workspace_account_sha_completed_partial",
    ]);
  });
});
