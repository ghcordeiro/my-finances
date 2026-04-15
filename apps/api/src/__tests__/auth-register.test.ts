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
    const users = await prisma.user.findMany();
    const orgs = await prisma.organization.findMany();
    const memberships = await prisma.membership.findMany();
    expect(users).toHaveLength(1);
    expect(orgs).toHaveLength(1);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("owner");
    expect(memberships[0]?.organizationId).toBe(orgs[0]?.id);
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
