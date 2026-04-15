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

describe("M3-T-010 isolamento imports", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("utilizador org A não acede a import de org B; accountId de outro workspace → 404", async () => {
    const app = await getTestApp();

    const a = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "iso-a@example.com",
        password: "longpassword1",
        organizationName: "Org A",
      },
    });
    const orgA = (a.json() as { organization: { id: string }; workspace: { id: string } }).organization.id;
    const wsA = (a.json() as { workspace: { id: string } }).workspace.id;
    const cookieA = extractSessionCookie(a.headers["set-cookie"])!;

    const b = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "iso-b@example.com",
        password: "longpassword1",
        organizationName: "Org B",
      },
    });
    const orgB = (b.json() as { organization: { id: string }; workspace: { id: string } }).organization.id;
    const wsB = (b.json() as { workspace: { id: string } }).workspace.id;
    const cookieB = extractSessionCookie(b.headers["set-cookie"])!;

    const accB = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${wsB}/accounts`,
      headers: { cookie: cookieB, "x-organization-id": orgB, "content-type": "application/json" },
      payload: { name: "Conta B", type: "checking" },
    });
    const accountB = (accB.json() as { account: { id: string } }).account.id;

    const buf = loadSampleOfx();
    const mp = buildMultipartImportPayload({ accountId: accountB }, { filename: "s.ofx", data: buf });
    const imp = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${wsB}/imports`,
      headers: { cookie: cookieB, "x-organization-id": orgB, ...mp.headers },
      payload: mp.payload,
    });
    expect(imp.statusCode).toBe(200);
    const batchId = (imp.json() as { importBatch: { id: string } }).importBatch.id;

    const leak = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${wsB}/imports/${batchId}`,
      headers: { cookie: cookieA, "x-organization-id": orgA },
    });
    expect(leak.statusCode).toBe(404);

    const accA = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${wsA}/accounts`,
      headers: { cookie: cookieA, "x-organization-id": orgA, "content-type": "application/json" },
      payload: { name: "Conta A", type: "checking" },
    });
    const accountA = (accA.json() as { account: { id: string } }).account.id;

    const wrongAcc = buildMultipartImportPayload({ accountId: accountB }, { filename: "x.ofx", data: buf });
    const bad = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${wsA}/imports`,
      headers: { cookie: cookieA, "x-organization-id": orgA, ...wrongAcc.headers },
      payload: wrongAcc.payload,
    });
    expect(bad.statusCode).toBe(404);
    expect((bad.json() as { error: string }).error).toBe("account_not_found");
  });
});
