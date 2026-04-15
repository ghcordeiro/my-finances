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

describe("M3-T-008 duplicate_import", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("segundo POST com os mesmos bytes → 409 duplicate_import", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "dedupe@example.com",
        password: "longpassword1",
        organizationName: "Org Dedupe",
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
    const mp = buildMultipartImportPayload({ accountId }, { filename: "sample.ofx", data: buf });

    const first = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...mp.headers },
      payload: mp.payload,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/imports`,
      headers: { cookie, "x-organization-id": org.id, ...mp.headers },
      payload: mp.payload,
    });
    expect(second.statusCode).toBe(409);
    expect((second.json() as { error: string }).error).toBe("duplicate_import");
  });
});
