import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("M1-T-005 / M1-T-006 transferências", () => {
  beforeEach(async () => {
    await resetAppTables();
    await prisma.planEntitlement.update({
      where: { planCode: "trial" },
      data: { maxWorkspaces: 10 },
    });
  });
  afterEach(async () => {
    await resetAppTables();
    await prisma.planEntitlement.update({
      where: { planCode: "trial" },
      data: { maxWorkspaces: 2 },
    });
  });

  it("intra-workspace transfer ok; personal↔personal inter-workspace 422", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "tfr@example.com",
        password: "longpassword1",
        organizationName: "Org Tfr",
      },
    });
    const org = (reg.json() as { organization: { id: string }; workspace: { id: string } }).organization;
    const w1 = (reg.json() as { workspace: { id: string } }).workspace;
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const w1b = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "Segundo PF", kind: "personal" },
    });
    expect(w1b.statusCode).toBe(201);
    const w2 = (w1b.json() as { workspace: { id: string } }).workspace.id;

    const c1 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w1.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "A", type: "checking", initialBalance: "500" },
    });
    const c2 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w1.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "B", type: "checking", initialBalance: "0" },
    });
    const idA = (c1.json() as { account: { id: string } }).account.id;
    const idB = (c2.json() as { account: { id: string } }).account.id;

    const intra = await app.inject({
      method: "POST",
      url: "/v1/transfers",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        fromAccountId: idA,
        toAccountId: idB,
        amount: "100.00",
        currency: "BRL",
        bookedAt: new Date().toISOString(),
      },
    });
    expect(intra.statusCode).toBe(201);

    const c3 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w2}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "Outro PF", type: "checking", initialBalance: "10" },
    });
    const idC = (c3.json() as { account: { id: string } }).account.id;

    const bad = await app.inject({
      method: "POST",
      url: "/v1/transfers",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        fromAccountId: idB,
        toAccountId: idC,
        amount: "5.00",
        currency: "BRL",
        bookedAt: new Date().toISOString(),
      },
    });
    expect(bad.statusCode).toBe(422);
    expect((bad.json() as { error: string }).error).toBe("transfer_workspace_kind_not_allowed");
  });

  it("personal ↔ business inter-workspace e listagem por workspace", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "tfr2@example.com",
        password: "longpassword1",
        organizationName: "Org Tfr2",
      },
    });
    const org = (reg.json() as { organization: { id: string }; workspace: { id: string } }).organization;
    const wPersonal = (reg.json() as { workspace: { id: string } }).workspace;
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const wb = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "PJ", kind: "business" },
    });
    const wBiz = (wb.json() as { workspace: { id: string } }).workspace.id;

    const accP = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${wPersonal.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "PF", type: "checking", initialBalance: "1000" },
    });
    const accB = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${wBiz}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "PJ cc", type: "checking", initialBalance: "0" },
    });
    const idP = (accP.json() as { account: { id: string } }).account.id;
    const idB = (accB.json() as { account: { id: string } }).account.id;

    const t = await app.inject({
      method: "POST",
      url: "/v1/transfers",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        fromAccountId: idP,
        toAccountId: idB,
        amount: "250.00",
        currency: "BRL",
        bookedAt: new Date().toISOString(),
        memo: "pró-labore",
      },
    });
    expect(t.statusCode).toBe(201);
    const tid = (t.json() as { transfer: { id: string } }).transfer.id;

    const listP = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${wPersonal.id}/transfers`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(listP.statusCode).toBe(200);
    const idsP = (listP.json() as { transfers: Array<{ id: string }> }).transfers.map((x) => x.id);
    expect(idsP).toContain(tid);

    const listB = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${wBiz}/transfers`,
      headers: { cookie, "x-organization-id": org.id },
    });
    const idsB = (listB.json() as { transfers: Array<{ id: string }> }).transfers.map((x) => x.id);
    expect(idsB).toContain(tid);
  });
});
