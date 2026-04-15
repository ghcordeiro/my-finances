import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("T-TEST-012 export stub RF-PLT-07", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("GET export retorna 501 com contrato estável", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "exp@example.com",
        password: "longpassword1",
        organizationName: "Exp",
      },
    });
    const orgId = (reg.json() as { organization: { id: string } }).organization.id;
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const res = await app.inject({
      method: "GET",
      url: `/v1/organizations/${orgId}/export`,
      headers: { cookie, "x-organization-id": orgId },
    });
    expect(res.statusCode).toBe(501);
    expect(res.json()).toEqual({ status: "not_implemented", issue: "RF-PLT-07" });
  });
});
