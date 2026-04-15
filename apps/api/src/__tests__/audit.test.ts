import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("T-TEST-007 audit append-only", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("register e login geram audit_logs", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "audit@example.com",
        password: "longpassword1",
        organizationName: "Aud",
      },
    });
    const orgId = (reg.json() as { organization: { id: string } }).organization.id;
    const userId = (reg.json() as { user: { id: string } }).user.id;
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { cookie, "content-type": "application/json" },
      payload: {},
    });

    await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: { email: "audit@example.com", password: "longpassword1" },
    });

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("auth.register");
    expect(actions).toContain("auth.login");
    expect(logs.some((l) => l.actorUserId === userId)).toBe(true);
  });
});
