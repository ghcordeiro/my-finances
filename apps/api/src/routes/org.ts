import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/require-auth.js";
import { requireOrgContext } from "../plugins/require-org.js";

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/organizations",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.sessionUserId!;
      const rows = await prisma.membership.findMany({
        where: { userId, status: "active" },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });
      await reply.send({
        organizations: rows.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
        })),
      });
    },
  );

  app.get(
    "/org-profile",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const org = await prisma.organization.findUnique({
        where: { id: request.organizationId! },
      });
      await reply.send({
        organization: org ? { id: org.id, name: org.name } : null,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/organizations/:id/export",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      if (request.params.id !== request.organizationId) {
        await reply.status(403).send({ error: "organization_mismatch" });
        return;
      }
      await reply.status(501).send({
        status: "not_implemented",
        issue: "RF-PLT-07",
      });
    },
  );
}
