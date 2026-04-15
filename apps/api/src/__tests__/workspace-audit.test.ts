import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("M1-T-007 auditoria M1", () => {
  beforeEach(async () => {
    await resetAppTables();
    await prisma.planEntitlement.update({
      where: { planCode: "trial" },
      data: { maxWorkspaces: 5 },
    });
  });
  afterEach(async () => {
    await resetAppTables();
    await prisma.planEntitlement.update({
      where: { planCode: "trial" },
      data: { maxWorkspaces: 2 },
    });
  });

  it("workspace.create, account.create, transfer.create com metadados", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "audm1@example.com",
        password: "longpassword1",
        organizationName: "Org Aud",
      },
    });
    const org = (reg.json() as { organization: { id: string }; workspace: { id: string } }).organization;
    const w0 = (reg.json() as { workspace: { id: string } }).workspace;
    const userId = (reg.json() as { user: { id: string } }).user.id;
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "PJ", kind: "business" },
    });

    await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w0.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "CC", type: "checking", initialBalance: "100" },
    });
    const acc = await prisma.account.findFirstOrThrow({ where: { workspaceId: w0.id } });

    const acc2 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w0.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "Poup", type: "investment", initialBalance: "0" },
    });
    const id2 = (acc2.json() as { account: { id: string } }).account.id;

    await app.inject({
      method: "POST",
      url: "/v1/transfers",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        fromAccountId: acc.id,
        toAccountId: id2,
        amount: "10",
        currency: "BRL",
        bookedAt: new Date().toISOString(),
      },
    });

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: org.id, actorUserId: userId },
      orderBy: { createdAt: "asc" },
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("workspace.create");
    expect(actions).toContain("account.create");
    expect(actions).toContain("transfer.create");

    const tr = logs.find((l) => l.action === "transfer.create");
    const meta = tr?.metadata as Record<string, unknown> | null;
    expect(meta?.organizationId).toBe(org.id);
    expect(typeof meta?.workspaceId).toBe("string");
  });
});
