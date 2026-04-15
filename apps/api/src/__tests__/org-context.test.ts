import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("T-TEST-005 X-Organization-Id", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("400 sem header; 403 sem membership; 200 com header válido", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "m@example.com",
        password: "longpassword1",
        organizationName: "Org M",
      },
    });
    expect(reg.statusCode).toBe(201);
    const orgId = (reg.json() as { organization: { id: string } }).organization.id;
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const noHeader = await app.inject({
      method: "GET",
      url: "/v1/org-profile",
      headers: { cookie },
    });
    expect(noHeader.statusCode).toBe(400);

    const badOrg = await app.inject({
      method: "GET",
      url: "/v1/org-profile",
      headers: { cookie, "x-organization-id": randomUUID() },
    });
    expect(badOrg.statusCode).toBe(403);

    const ok = await app.inject({
      method: "GET",
      url: "/v1/org-profile",
      headers: { cookie, "x-organization-id": orgId },
    });
    expect(ok.statusCode).toBe(200);
  });
});
