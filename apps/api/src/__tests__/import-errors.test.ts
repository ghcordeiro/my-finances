import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";
import { buildMultipartImportPayload } from "./multipart-form.js";

function loadSampleOfx(): Buffer {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "fixtures", "sample.ofx"));
}

describe("M3-T-012 erros import", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("invalid_multipart, csv_template_required, invalid_file (import_too_many_lines: ver apply-csv-template.test)", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "err-imp@example.com",
        password: "longpassword1",
        organizationName: "Org Err",
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

    const noAcc = buildMultipartImportPayload({}, { filename: "x.ofx", data: loadSampleOfx() });
    const m1 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...noAcc.headers },
      payload: noAcc.payload,
    });
    expect(m1.statusCode).toBe(400);
    expect((m1.json() as { error: string }).error).toBe("invalid_multipart");

    const csvNoTpl = buildMultipartImportPayload({ accountId }, { filename: "x.csv", data: Buffer.from("a;b\n1;2") });
    const m2 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...csvNoTpl.headers },
      payload: csvNoTpl.payload,
    });
    expect(m2.statusCode).toBe(422);
    expect((m2.json() as { error: string }).error).toBe("csv_template_required");

    const badOfx = buildMultipartImportPayload({ accountId }, { filename: "bad.ofx", data: Buffer.from("not-ofx") });
    const m3 = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...badOfx.headers },
      payload: badOfx.payload,
    });
    expect(m3.statusCode).toBe(400);
    expect((m3.json() as { error: string }).error).toBe("invalid_file");

    const huge = Buffer.alloc(10 * 1024 * 1024 + 1, 79);
    const m5 = buildMultipartImportPayload({ accountId }, { filename: "huge.ofx", data: huge });
    const big = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...m5.headers },
      payload: m5.payload,
    });
    expect(big.statusCode).toBe(413);
    expect((big.json() as { error: string }).error).toBe("file_too_large");
  });
});
