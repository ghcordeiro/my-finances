import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";
import { buildMultipartImportPayload } from "./multipart-form.js";

const OFX1 = Buffer.from(
  [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "<OFX>",
    "<BANKMSGSRSV1><STMTTRNRS><BANKTRANLIST>",
    "<STMTTRN><TRNAMT>-1.00<DTPOSTED>20240201<FITID>stable-line-1<MEMO>A</STMTTRN>",
    "</BANKTRANLIST></STMTTRNRS></BANKMSGSRSV1></OFX>",
  ].join("\n"),
  "utf-8",
);

const OFX2 = Buffer.from(
  [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "<OFX>",
    "<BANKMSGSRSV1><STMTTRNRS><BANKTRANLIST>",
    "<STMTTRN><TRNAMT>-9.99<DTPOSTED>20240202<FITID>stable-line-1<MEMO>B</STMTTRN>",
    "</BANKTRANLIST></STMTTRNRS></BANKMSGSRSV1></OFX>",
  ].join("\n"),
  "utf-8",
);

describe("M3-T-014 idempotência por linha (FITID)", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("segundo ficheiro com mesmo FITID → skippedDuplicate > 0 sem segundo posting", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "line-dedupe@example.com",
        password: "longpassword1",
        organizationName: "Org Line",
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

    const first = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: {
        cookie,
        "x-organization-id": org.id,
        ...buildMultipartImportPayload({ accountId }, { filename: "a.ofx", data: OFX1 }).headers,
      },
      payload: buildMultipartImportPayload({ accountId }, { filename: "a.ofx", data: OFX1 }).payload,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: {
        cookie,
        "x-organization-id": org.id,
        ...buildMultipartImportPayload({ accountId }, { filename: "b.ofx", data: OFX2 }).headers,
      },
      payload: buildMultipartImportPayload({ accountId }, { filename: "b.ofx", data: OFX2 }).payload,
    });
    expect(second.statusCode).toBe(200);
    const summary = (second.json() as { resultSummary: { skippedDuplicate: number; inserted: number } })
      .resultSummary;
    expect(summary.skippedDuplicate).toBeGreaterThanOrEqual(1);
    expect(summary.inserted).toBe(0);

    const postings = await prisma.accountImportPosting.findMany({
      where: { accountId, externalStableId: "stable-line-1" },
    });
    expect(postings.length).toBe(1);
  });
});
