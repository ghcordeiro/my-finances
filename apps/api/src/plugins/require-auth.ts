import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveSessionUserId } from "../auth/session.js";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = await resolveSessionUserId(request);
  if (!userId) {
    return reply.status(401).send({ error: "unauthorized" });
  }
  request.sessionUserId = userId;
}
