import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { resetAppTables } from "./test-db.js";

/** M2-T-001 — smoke de schema M2 (cartões, faturas, linhas, planos). */
describe("M2-T-001 schema M2", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("modelos M2 respondem a findMany (tabelas + enums)", async () => {
    const [cards, statements, lines, plans] = await Promise.all([
      prisma.creditCard.findMany(),
      prisma.creditCardStatement.findMany(),
      prisma.creditCardStatementLine.findMany(),
      prisma.installmentPlan.findMany(),
    ]);
    expect(Array.isArray(cards)).toBe(true);
    expect(Array.isArray(statements)).toBe(true);
    expect(Array.isArray(lines)).toBe(true);
    expect(Array.isArray(plans)).toBe(true);
  });
});
