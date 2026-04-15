import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";

const HEADER = "x-organization-id";

export async function requireOrgContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const raw = request.headers[HEADER];
  const orgId = Array.isArray(raw) ? raw[0] : raw;
  if (!orgId || orgId.trim() === "") {
    return reply.status(400).send({
      error: "missing_organization",
      message: "X-Organization-Id é obrigatório.",
    });
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(orgId)) {
    return reply.status(400).send({
      error: "invalid_organization",
      message: "X-Organization-Id inválido.",
    });
  }

  const userId = request.sessionUserId;
  if (!userId) {
    return reply.status(401).send({ error: "unauthorized" });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId: orgId,
      status: "active",
    },
  });
  if (!membership) {
    return reply.status(403).send({
      error: "forbidden",
      message: "Sem acesso a esta organização.",
    });
  }

  request.organizationId = orgId;
}
