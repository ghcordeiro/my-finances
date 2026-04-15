import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";
import { buildMultipartImportPayload } from "./multipart-form.js";

function loadSampleOfx(): Buffer {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "fixtures", "sample.ofx"));
}

describe("M3-T-013 auditoria imports", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("regista import_batch_created e import_batch_completed", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "aud-imp@example.com",
        password: "longpassword1",
        organizationName: "Org Aud",
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
    expect(imp.statusCode).toBe(200);
    const batchId = (imp.json() as { importBatch: { id: string } }).importBatch.id;

    const created = await prisma.auditLog.count({
      where: { organizationId: org.id, action: "import_batch_created", resourceId: batchId },
    });
    const completed = await prisma.auditLog.count({
      where: { organizationId: org.id, action: "import_batch_completed", resourceId: batchId },
    });
    expect(created).toBeGreaterThanOrEqual(1);
    expect(completed).toBeGreaterThanOrEqual(1);
  });
});
