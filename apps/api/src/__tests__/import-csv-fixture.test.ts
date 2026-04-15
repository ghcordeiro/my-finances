import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";
import { buildMultipartImportPayload } from "./multipart-form.js";

describe("M3-T-009 import CSV com template", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("fixture CSV + template → valores e datas esperados", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "csv-fix@example.com",
        password: "longpassword1",
        organizationName: "Org CSV",
      },
    });
    const { organization: org, workspace: ws } = reg.json() as {
      organization: { id: string };
      workspace: { id: string };
    };
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const accRes = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/accounts`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "Conta", type: "checking" },
    });
    const accountId = (accRes.json() as { account: { id: string } }).account.id;

    const tpl = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/csv-templates`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        name: "Extrato BR",
        columnMap: { date: "d", description: "h", amount: "v" },
        dateFormat: "dd/MM/yyyy",
        decimalSeparator: ",",
        scope: "workspace",
      },
    });
    const templateId = (tpl.json() as { template: { id: string } }).template.id;

    const csv = Buffer.from(["d;h;v", "15/03/2024;Compra teste;-5,25"].join("\n"), "utf-8");
    const mp = buildMultipartImportPayload(
      { accountId, templateId },
      { filename: "mov.csv", data: csv },
    );

    const res = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(200);

    const postings = await prisma.accountImportPosting.findMany({ where: { accountId } });
    expect(postings).toHaveLength(1);
    expect(postings[0]!.amount.toFixed(2)).toBe("-5.25");
    expect(postings[0]!.bookedAt.toISOString()).toBe("2024-03-15T03:00:00.000Z");
  });
});
