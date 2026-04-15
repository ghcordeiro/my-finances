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

describe("M3-T-011 GET imports", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("lista e detalhe de import batch", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "list-imp@example.com",
        password: "longpassword1",
        organizationName: "Org List",
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
    const buf = loadSampleOfx();
    const mp = buildMultipartImportPayload({ accountId }, { filename: "s.ofx", data: buf });
    const imp = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...mp.headers },
      payload: mp.payload,
    });
    const batchId = (imp.json() as { importBatch: { id: string } }).importBatch.id;

    const list = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${ws.id}/imports?limit=10&offset=0`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(list.statusCode).toBe(200);
    const imports = (list.json() as { imports: Array<{ id: string }> }).imports;
    expect(imports.some((i) => i.id === batchId)).toBe(true);

    const detail = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${ws.id}/imports/${batchId}`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { importBatch: { id: string } }).importBatch.id).toBe(batchId);

    const missing = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${ws.id}/imports/00000000-0000-4000-8000-000000000001`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(missing.statusCode).toBe(404);
    expect((missing.json() as { error: string }).error).toBe("import_not_found");
  });
});
