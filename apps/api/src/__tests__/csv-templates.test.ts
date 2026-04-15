import argon2 from "argon2";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

const columnMap = {
  date: "d",
  description: "h",
  amount: "v",
};

describe("M3-T-005 csv-templates API", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("CRUD, scope e 409 nome duplicado", async () => {
    const app = await getTestApp();
    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "tpl@example.com",
        password: "longpassword1",
        organizationName: "Org Tpl",
      },
    });
    const { organization: org, workspace: ws } = reg.json() as {
      organization: { id: string };
      workspace: { id: string };
    };
    const cookie = extractSessionCookie(reg.headers["set-cookie"])!;

    const create = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/csv-templates`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        name: "Banco X",
        columnMap,
        dateFormat: "dd/MM/yyyy",
        decimalSeparator: ",",
        scope: "workspace",
      },
    });
    expect(create.statusCode).toBe(201);
    const tid = (create.json() as { template: { id: string } }).template.id;

    const dup = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/csv-templates`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        name: "Banco X",
        columnMap,
        dateFormat: "dd/MM/yyyy",
        decimalSeparator: ",",
        scope: "workspace",
      },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: string }).error).toBe("template_name_conflict");

    const list = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${ws.id}/csv-templates?scope=workspace`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { templates: unknown[] }).templates.length).toBeGreaterThanOrEqual(1);

    const patch = await app.inject({
      method: "PATCH",
      url: `/v1/workspaces/${ws.id}/csv-templates/${tid}`,
      headers: { cookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: { name: "Banco X v2" },
    });
    expect(patch.statusCode).toBe(200);

    const del = await app.inject({
      method: "DELETE",
      url: `/v1/workspaces/${ws.id}/csv-templates/${tid}`,
      headers: { cookie, "x-organization-id": org.id },
    });
    expect(del.statusCode).toBe(204);
  });

  it("scope organization: owner OK, member 403", async () => {
    const app = await getTestApp();
    const ownerReg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "owner-tpl@example.com",
        password: "longpassword1",
        organizationName: "Org Owner",
      },
    });
    const { organization: org, workspace: ws } = ownerReg.json() as {
      organization: { id: string };
      workspace: { id: string };
    };
    const ownerCookie = extractSessionCookie(ownerReg.headers["set-cookie"])!;

    const hash = await argon2.hash("longpassword1");
    const member = await prisma.user.create({
      data: { email: "member-tpl@example.com", passwordHash: hash },
    });
    await prisma.membership.create({
      data: {
        userId: member.id,
        organizationId: org.id,
        role: "member",
        status: "active",
      },
    });

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: { email: "member-tpl@example.com", password: "longpassword1" },
    });
    const memberCookie = extractSessionCookie(login.headers["set-cookie"])!;

    const forbidden = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/csv-templates`,
      headers: { cookie: memberCookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        name: "Org wide",
        columnMap,
        dateFormat: "dd/MM/yyyy",
        decimalSeparator: ",",
        scope: "organization",
      },
    });
    expect(forbidden.statusCode).toBe(403);

    const ok = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${ws.id}/csv-templates`,
      headers: { cookie: ownerCookie, "x-organization-id": org.id, "content-type": "application/json" },
      payload: {
        name: "Org wide",
        columnMap,
        dateFormat: "dd/MM/yyyy",
        decimalSeparator: ",",
        scope: "organization",
      },
    });
    expect(ok.statusCode).toBe(201);
  });
});
