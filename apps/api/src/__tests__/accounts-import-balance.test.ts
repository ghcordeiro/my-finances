import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("M3-T-004 saldo inclui AccountImportPosting", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("currentBalance soma postings de importação (ADR-0011 §2)", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "bal-import@example.com",
        password: "longpassword1",
        organizationName: "Org Bal",
      },
    });
    expect(reg.statusCode).toBe(201);
    const { organization: org, workspace: ws, user } = reg.json() as {
      organization: { id: string };
      workspace: { id: string };
      user: { id: string };
    };
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const accRes = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "CC", type: "checking", initialBalance: "100.00" },
    });
    const accountId = (accRes.json() as { account: { id: string } }).account.id;

    const batch = await prisma.importBatch.create({
      data: {
        organizationId: org.id,
        workspaceId: ws.id,
        targetAccountId: accountId,
        createdByUserId: user.id,
        originalFilename: "x.ofx",
        contentSha256: "a".repeat(64),
        byteSize: 1,
        storageKey: "k",
        status: "completed",
      },
    });

    await prisma.accountImportPosting.create({
      data: {
        organizationId: org.id,
        workspaceId: ws.id,
        accountId,
        importBatchId: batch.id,
        amount: new Prisma.Decimal("25.50"),
        currency: "BRL",
        bookedAt: new Date("2024-01-01T00:00:00.000Z"),
        memo: "posting",
        externalStableId: "ext-1",
      },
    });

    const list = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${ws.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(list.statusCode).toBe(200);
    const row = (list.json() as { accounts: Array<{ currentBalance: string }> }).accounts[0];
    expect(row?.currentBalance).toBe("125.50");
  });
});
