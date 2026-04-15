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
