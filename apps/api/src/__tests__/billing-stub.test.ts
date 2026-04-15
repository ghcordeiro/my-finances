import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";

describe("T-TEST-009 billing stub (BILLING_PROVIDER=none)", () => {
  const prev = process.env.BILLING_PROVIDER;

  beforeEach(async () => {
    process.env.BILLING_PROVIDER = "none";
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
    if (prev === undefined) delete process.env.BILLING_PROVIDER;
    else process.env.BILLING_PROVIDER = prev;
  });

  it("register cria Subscription trial", async () => {
    const app = await getTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      headers: { "content-type": "application/json" },
      payload: {
        email: "bill@example.com",
        password: "longpassword1",
        organizationName: "Bill Org",
      },
    });
    const orgId = (res.json() as { organization: { id: string } }).organization.id;
    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    expect(sub?.planCode).toBe("trial");
    expect(sub?.status).toBe("trialing");
  });
});
