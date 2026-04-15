/**
 * CA-00: dois inquilinos distintos não se veem via API autenticada com header de org.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("T-TEST-006 isolamento CA-00", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("user B não acessa org A; vê apenas org B", async () => {
    const app = await getTestApp();

    const a = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "a@example.com",
        password: "longpassword1",
        organizationName: "Empresa Igual",
      },
    });
    const orgA = (a.json() as { organization: { id: string } }).organization.id;
    const cookieA = extractSessionCookie(a.headers["set-cookie"])!;

    const b = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "b@example.com",
        password: "longpassword1",
        organizationName: "Empresa Igual",
      },
    });
    const orgB = (b.json() as { organization: { id: string } }).organization.id;
    const cookieB = extractSessionCookie(b.headers["set-cookie"])!;

    const leak = await app.inject({
      method: "GET",
      url: "/v1/org-profile",
      headers: { cookie: cookieB, "x-organization-id": orgA },
    });
    expect(leak.statusCode).toBe(403);

    const okB = await app.inject({
      method: "GET",
      url: "/v1/org-profile",
      headers: { cookie: cookieB, "x-organization-id": orgB },
    });
    expect(okB.statusCode).toBe(200);
    expect((okB.json() as { organization: { name: string } }).organization.name).toBe(
      "Empresa Igual",
    );

    const okA = await app.inject({
      method: "GET",
      url: "/v1/org-profile",
      headers: { cookie: cookieA, "x-organization-id": orgA },
    });
    expect(okA.statusCode).toBe(200);

    const wsB = (b.json() as { workspace: { id: string } }).workspace.id;
    const m1leak = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${wsB}/accounts`,
      headers: { cookie: cookieA, "x-organization-id": orgA },
    });
    expect(m1leak.statusCode).toBe(404);
    expect((m1leak.json() as { error: string }).error).toBe("workspace_not_found");
  });
});
