import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("M1-T-004 contas por workspace", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("contas de W1 não aparecem em GET de W2; workspace arquivado bloqueia nova conta", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "acc@example.com",
        password: "longpassword1",
        organizationName: "Org Acc",
      },
    });
    const { organization: org, workspace: w1 } = reg.json() as {
      organization: { id: string };
      workspace: { id: string };
    };
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const w2res = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "PJ", kind: "business" },
    });
    expect(w2res.statusCode).toBe(201);
    const w2Id = (w2res.json() as { workspace: { id: string } }).workspace.id;

    const a1 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w1.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "CC Pessoal", type: "checking", initialBalance: "100.00" },
    });
    expect(a1.statusCode).toBe(201);

    const listW2 = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${w2Id}/accounts`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(listW2.statusCode).toBe(200);
    expect((listW2.json() as { accounts: unknown[] }).accounts).toHaveLength(0);

    const listW1 = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${w1.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(listW1.statusCode).toBe(200);
    expect((listW1.json() as { accounts: Array<{ currentBalance: string }> }).accounts).toHaveLength(1);
    expect((listW1.json() as { accounts: Array<{ currentBalance: string }> }).accounts[0]?.currentBalance).toBe(
      "100.00",
    );

    await app.inject({
      method: "PATCH",
      url: `/v1/workspaces/${w2Id}`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { archive: true },
    });

    const blocked = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w2Id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "Não pode", type: "checking" },
    });
    expect(blocked.statusCode).toBe(422);
    expect((blocked.json() as { error: string }).error).toBe("workspace_archived");
  });

  it("workspace id de outra org → 404", async () => {
    const app = await getTestApp();
    const a = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "aacc@example.com",
        password: "longpassword1",
        organizationName: "Org Alfa",
      },
    });
    const orgA = (a.json() as { organization: { id: string } }).organization.id;
    const cookieA = extractSessionCookie(a.headers["set-cookie"])!;

    const b = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "bacc@example.com",
        password: "longpassword1",
        organizationName: "Org Beta",
      },
    });
    const wB = (b.json() as { workspace: { id: string } }).workspace.id;

    const leak = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${wB}/accounts`,
      headers: { cookie: cookieA, "x-organization-id": orgA },
    });
    expect(leak.statusCode).toBe(404);
    expect((leak.json() as { error: string }).error).toBe("workspace_not_found");
  });
});
