import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { getTestApp } from "./test-app.js";
import { resetAppTables } from "./test-db.js";

describe("T-TEST-008 webhook Stripe idempotente", () => {
  const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    await resetAppTables();
  });
  afterEach(async () => {
    await resetAppTables();
    if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
  });

  it("processa customer.subscription.updated uma vez", async () => {
    const orgId = randomUUID();
    await prisma.organization.create({
      data: {
        id: orgId,
        name: "Stripe Org",
        subscriptions: {
          create: {
            planCode: "trial",
            status: "trialing",
          },
        },
      },
    });

    const event = {
      id: "evt_test_webhook_1",
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test_1",
          object: "subscription",
          customer: "cus_test",
          status: "active",
          metadata: { organization_id: orgId },
          current_period_end: Math.floor(Date.now() / 1000) + 86_400,
          items: { data: [] },
        },
      },
    } as unknown as Stripe.Event;

    const payload = Buffer.from(JSON.stringify(event));
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });

    const app = await getTestApp();
    const first = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: {
        "stripe-signature": header,
        "content-type": "application/json",
      },
      payload,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: {
        "stripe-signature": header,
        "content-type": "application/json",
      },
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect((second.json() as { duplicate?: boolean }).duplicate).toBe(true);

    const rows = await prisma.stripeEventProcessed.findMany({
      where: { eventId: "evt_test_webhook_1" },
    });
    expect(rows).toHaveLength(1);
  });
});
