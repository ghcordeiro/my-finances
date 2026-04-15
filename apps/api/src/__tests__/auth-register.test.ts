import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";

describe("T-TEST-003 POST /v1/auth/register", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("201 cria user, org e membership owner", async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "owner@example.com",
        password: "hunter2hunter",
        organizationName: "Minha Org",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      workspace: { id: string; kind: string; name: string };
      organization: { id: string };
    };
    expect(body.workspace.kind).toBe("personal");
    expect(body.workspace.name).toBe("Pessoal");

    const users = await prisma.user.findMany();
    const orgs = await prisma.organization.findMany();
    const memberships = await prisma.membership.findMany();
    const workspaces = await prisma.workspace.findMany();
    expect(users).toHaveLength(1);
    expect(orgs).toHaveLength(1);
    expect(memberships).toHaveLength(1);
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]?.organizationId).toBe(orgs[0]?.id);
    expect(workspaces[0]?.id).toBe(body.workspace.id);
    expect(memberships[0]?.role).toBe("owner");
    expect(memberships[0]?.organizationId).toBe(orgs[0]?.id);
  });

  it("M1-T-002: após registo existe workspace personal ativo default", async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "m1onboard@example.com",
        password: "hunter2hunter",
        organizationName: "Org M1",
      },
    });
    expect(res.statusCode).toBe(201);
    const orgId = (res.json() as { organization: { id: string } }).organization.id;
    const wsList = await prisma.workspace.findMany({ where: { organizationId: orgId } });
    expect(wsList).toHaveLength(1);
    expect(wsList[0]?.kind).toBe("personal");
    expect(wsList[0]?.archivedAt).toBeNull();
    expect(wsList[0]?.name.length).toBeGreaterThan(0);
  });

  it("409 para email duplicado", async () => {
    const app = await getTestApp();
    const body = {
      email: "dup@example.com",
      password: "hunter2hunter",
      organizationName: "Org A",
    };
    const first = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: body,
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: { ...body, organizationName: "Org B" },
    });
    expect(second.statusCode).toBe(409);
  });
});
