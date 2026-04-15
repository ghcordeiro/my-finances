import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { appendAudit } from "../services/audit.js";

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    app.log.warn("STRIPE_WEBHOOK_SECRET ausente — webhooks Stripe desativados.");
  }

  app.post("/stripe", async (request, reply) => {
    if (!secret) {
      await reply.status(503).send({ error: "webhook_not_configured" });
      return;
    }
    const sig = request.headers["stripe-signature"];
    if (!sig || Array.isArray(sig)) {
      await reply.status(400).send({ error: "missing_signature" });
      return;
    }
    const raw = Buffer.isBuffer(request.body)
      ? (request.body as Buffer)
      : request.rawBody;
    if (!raw) {
      await reply.status(400).send({ error: "missing_raw_body" });
      return;
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(raw, sig, secret);
    } catch (err) {
      request.log.warn({ err }, "stripe_signature_invalid");
      await reply.status(400).send({ error: "invalid_signature" });
      return;
    }

    const existing = await prisma.stripeEventProcessed.findUnique({
      where: { eventId: event.id },
    });
    if (existing) {
      await reply.send({ received: true, duplicate: true });
      return;
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const periodEndUnix =
        (sub as unknown as { current_period_end?: number }).current_period_end ??
        (sub.items?.data[0] as { current_period_end?: number } | undefined)?.current_period_end;
      const orgId =
        typeof sub.metadata?.organization_id === "string"
          ? sub.metadata.organization_id
          : null;
      if (orgId) {
        const statusMap: Record<
          string,
          "active" | "trialing" | "past_due" | "canceled" | "incomplete"
        > = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          incomplete: "incomplete",
        };
        const mapped = statusMap[sub.status] ?? "incomplete";
        const stripeCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
        await prisma.$transaction(async (tx) => {
          await tx.stripeEventProcessed.create({ data: { eventId: event.id } });
          const current = await tx.subscription.findUnique({
            where: { organizationId: orgId },
          });
          if (current) {
            await tx.subscription.update({
              where: { organizationId: orgId },
              data: {
                stripeCustomerId,
                stripeSubscriptionId: sub.id,
                status: mapped,
                currentPeriodEnd:
                  typeof periodEndUnix === "number" ? new Date(periodEndUnix * 1000) : null,
              },
            });
          }
        });

        const row = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
        await appendAudit({
          organizationId: orgId,
          actorUserId: null,
          action: "billing.subscription_updated",
          resourceType: "subscription",
          resourceId: row?.id ?? orgId,
          metadata: { stripeSubscriptionId: sub.id, status: sub.status },
        });
      } else {
        await prisma.stripeEventProcessed.create({ data: { eventId: event.id } });
      }
    } else {
      await prisma.stripeEventProcessed.create({ data: { eventId: event.id } });
    }

    await reply.send({ received: true });
  });
}
