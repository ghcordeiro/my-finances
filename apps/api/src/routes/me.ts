import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/require-auth.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.sessionUserId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    await reply.send({ user });
  });
}
