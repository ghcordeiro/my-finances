import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";
import { buildMultipartImportPayload } from "./multipart-form.js";

function ofxOne(fitid: string, trnamt: string): Buffer {
  return Buffer.from(
    [
      "OFXHEADER:100",
      "DATA:OFXSGML",
      "<OFX>",
      "<BANKMSGSRSV1><STMTTRNRS><BANKTRANLIST>",
      `<STMTTRN><TRNAMT>${trnamt}<DTPOSTED>20240301<FITID>${fitid}</STMTTRN>`,
      "</BANKTRANLIST></STMTTRNRS></BANKMSGSRSV1></OFX>",
    ].join("\n"),
    "utf-8",
  );
}

describe("M3-T-015 concorrência imports (opcional)", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("dois imports em paralelo na mesma conta terminam sem violar unicidade FITID", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "conc-imp@example.com",
        password: "longpassword1",
        organizationName: "Org Conc",
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
      payload: { name: "C", type: "checking" },
    });
    const accountId = (accRes.json() as { account: { id: string } }).account.id;

    const p1 = buildMultipartImportPayload({ accountId }, { filename: "p1.ofx", data: ofxOne("conc-a", "-1.00") });
    const p2 = buildMultipartImportPayload({ accountId }, { filename: "p2.ofx", data: ofxOne("conc-b", "-2.00") });

    const [r1, r2] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/v1/workspaces/${ws.id}/imports`,
        headers: { cookie, "x-organization-id": org.id, ...p1.headers },
        payload: p1.payload,
      }),
      app.inject({
        method: "POST",
        url: `/v1/workspaces/${ws.id}/imports`,
        headers: { cookie, "x-organization-id": org.id, ...p2.headers },
        payload: p2.payload,
      }),
    ]);

    expect([r1.statusCode, r2.statusCode].every((c) => c === 200)).toBe(true);

    const postings = await prisma.accountImportPosting.findMany({ where: { accountId } });
    const ids = new Set(postings.map((p) => p.externalStableId ?? ""));
    expect(ids.size).toBe(postings.length);
  });
});
