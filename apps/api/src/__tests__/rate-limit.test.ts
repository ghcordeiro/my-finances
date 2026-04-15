import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestApp, getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";

describe("T-TEST-011 rate limit /v1/auth", () => {
  const prevMax = process.env.RATE_LIMIT_AUTH_MAX;
  const prevWin = process.env.RATE_LIMIT_AUTH_WINDOW_MS;

  beforeEach(async () => {
    await closeTestApp();
    process.env.RATE_LIMIT_AUTH_MAX = "3";
    process.env.RATE_LIMIT_AUTH_WINDOW_MS = `${300_000}`;
    await resetAppTables();
  });

  afterEach(async () => {
    await resetAppTables();
    if (prevMax === undefined) delete process.env.RATE_LIMIT_AUTH_MAX;
    else process.env.RATE_LIMIT_AUTH_MAX = prevMax;
    if (prevWin === undefined) delete process.env.RATE_LIMIT_AUTH_WINDOW_MS;
    else process.env.RATE_LIMIT_AUTH_WINDOW_MS = prevWin;
    await closeTestApp();
  });

  it("várias tentativas de login falho terminam em 429", async () => {
    const app = await getTestApp();
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: { "content-type": "application/json" },
        payload: { email: "nope@example.com", password: "wrong" },
      });
      expect([400, 401]).toContain(res.statusCode);
    }
    const blocked = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: { email: "nope@example.com", password: "wrong" },
    });
    expect(blocked.statusCode).toBe(429);
  });
});
