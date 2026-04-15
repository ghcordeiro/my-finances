import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("M2 cartões e faturas (API)", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("M2-CA-01: cartão em W1 não aparece em GET de W2; workspace inválido → 404", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "cards@example.com",
        password: "longpassword1",
        organizationName: "Org Cards",
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
    const w2Id = (w2res.json() as { workspace: { id: string } }).workspace.id;

    const create = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w1.id}/cards`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        name: "Nubank",
        creditLimit: "5000.00",
        closingDay: 10,
        dueDay: 17,
      },
    });
    expect(create.statusCode).toBe(201);

    const listW2 = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${w2Id}/cards`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(listW2.statusCode).toBe(200);
    expect((listW2.json() as { cards: unknown[] }).cards).toHaveLength(0);

    const badWs = await app.inject({
      method: "GET",
      url: `/v1/workspaces/00000000-0000-4000-8000-000000000001/cards`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(badWs.statusCode).toBe(404);
    expect((badWs.json() as { error: string }).error).toBe("workspace_not_found");
  });

  it("M2-CA-02: compra 12x soma parcelas = amount", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "inst@example.com",
        password: "longpassword1",
        organizationName: "Org Inst",
      },
    });
    const { organization: org, workspace: w } = reg.json() as {
      organization: { id: string };
      workspace: { id: string };
    };
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const create = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w.id}/cards`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        name: "Visa",
        creditLimit: "20000.00",
        closingDay: 10,
        dueDay: 17,
      },
    });
    const cardId = (create.json() as { card: { id: string } }).card.id;

    const pur = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${w.id}/cards/${cardId}/purchases`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        amount: "1200.00",
        purchasedAt: new Date("2026-03-05T12:00:00.000Z").toISOString(),
        installmentCount: 12,
        memo: "TV",
      },
    });
    expect(pur.statusCode).toBe(201);

    const stmts = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${w.id}/cards/${cardId}/statements`,
      headers: { cookie, "x-organization-id": org.id },
    });
    const ids = (stmts.json() as { statements: Array<{ id: string }> }).statements.map((s) => s.id);
    let sum = new Prisma.Decimal(0);
    for (const id of ids) {
      const det = await app.inject({
        method: "GET",
        url: `/v1/workspaces/${w.id}/cards/${cardId}/statements/${id}`,
        headers: { cookie, "x-organization-id": org.id },
      });
      const lines = (det.json() as { statement: { lines: Array<{ lineKind: string; amount: string }> } }).statement
        .lines;
      for (const l of lines) {
        if (l.lineKind === "installment") {
          sum = sum.add(new Prisma.Decimal(l.amount));
        }
      }
    }
    expect(sum.toFixed(2)).toBe("1200.00");
  });
});
