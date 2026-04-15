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

describe("M3-T-007 POST imports OFX", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("importa OFX e devolve batch completed com resultSummary", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "ofx-up@example.com",
        password: "longpassword1",
        organizationName: "Org OFX",
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
      payload: { name: "Conta", type: "checking", initialBalance: "0" },
    });
    const accountId = (accRes.json() as { account: { id: string } }).account.id;

    const buf = loadSampleOfx();
    const mp = buildMultipartImportPayload({ accountId }, { filename: "sample.ofx", data: buf });

    const res = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...mp.headers },
      payload: mp.payload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      importBatch: { id: string; status: string };
      resultSummary: { inserted: number; skippedDuplicate: number; parseErrors: number };
    };
    expect(body.importBatch.status).toMatch(/completed|partial/);
    expect(body.resultSummary.inserted).toBe(2);

    const postings = await prisma.accountImportPosting.count({ where: { accountId } });
    expect(postings).toBe(2);
  });
});
