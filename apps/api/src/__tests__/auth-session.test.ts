import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";
import { extractSessionCookie } from "./cookie-helper.js";

describe("T-TEST-004 sessão cookie", () => {
  beforeEach(async () => {
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
  });

  it("login define cookie; /v1/me autenticado; logout invalida", async () => {
    const app = await getTestApp();
    await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "u@example.com",
        password: "longpassword1",
        organizationName: "Org",
      },
    });
    await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { "content-type": "application/json" },
      payload: {},
    });

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: { email: "u@example.com", password: "longpassword1" },
    });
    expect(login.statusCode).toBe(200);
    const cookie = extractSessionCookie(login.headers["set-cookie"]);
    expect(cookie).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { cookie: cookie! },
    });
    expect(me.statusCode).toBe(200);

    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { cookie: cookie!, "content-type": "application/json" },
      payload: {},
    });
    expect(logout.statusCode).toBe(200);

    const meAfter = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: { cookie: cookie! },
    });
    expect(meAfter.statusCode).toBe(401);
  });
});
