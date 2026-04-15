import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("M1-T-003 workspaces REST", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  async function register(app: FastifyInstance, email: string) {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email,
        password: "longpassword1",
        organizationName: "Org WS",
      },
    });
    expect(res.statusCode).toBe(201);
    const j = res.json() as { organization: { id: string }; workspace: { id: string } };
    const cookie = extractSessionCookie(res.headers["set-cookie"])!;
    return { orgId: j.organization.id, cookie, defaultWorkspaceId: j.workspace.id };
  }

  it("GET /v1/workspaces lista workspaces da org", async () => {
    const app = await getTestApp();
    const { orgId, cookie, defaultWorkspaceId } = await register(app, "ws1@example.com");

    const list = await app.inject({
      method: "GET",
      url: "/v1/workspaces",
      headers: { cookie, "x-organization-id": orgId },
    });
    expect(list.statusCode).toBe(200);
    const data = list.json() as { workspaces: Array<{ id: string; kind: string }> };
    expect(data.workspaces.length).toBeGreaterThanOrEqual(1);
    expect(data.workspaces.some((w) => w.id === defaultWorkspaceId)).toBe(true);
  });

  it("POST workspace respeita limite do plano (409)", async () => {
    const app = await getTestApp();
    const { orgId, cookie } = await register(app, "ws2@example.com");

    const second = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { cookie, "x-organization-id": orgId, "content-type": "application/json" },
      payload: { name: "Empresa", kind: "business" },
    });
    expect(second.statusCode).toBe(201);

    const third = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: { cookie, "x-organization-id": orgId, "content-type": "application/json" },
      payload: { name: "Outra", kind: "business" },
    });
    expect(third.statusCode).toBe(409);
    expect((third.json() as { error: string }).error).toBe("workspace_limit_exceeded");
  });

  it("PATCH workspace inexistente na org → 404", async () => {
    const app = await getTestApp();
    const { orgId, cookie } = await register(app, "ws3@example.com");
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/workspaces/${randomUUID()}`,
      headers: { cookie, "x-organization-id": orgId, "content-type": "application/json" },
      payload: { name: "X" },
    });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: string }).error).toBe("workspace_not_found");
  });
});
