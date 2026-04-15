import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { registerUserAndOrg } from "../services/registration.js";
import { appendLoginAudit, createSession, destroySession } from "../auth/session.js";

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(2).max(120),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", async (request, reply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
      return;
    }
    try {
      const { user, organization } = await registerUserAndOrg(parsed.data);
      await createSession(user.id, reply);
      await reply.status(201).send({
        user: { id: user.id, email: user.email },
        organization: { id: organization.id, name: organization.name },
      });
    } catch (e: unknown) {
      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        await reply.status(409).send({ error: "email_taken" });
        return;
      }
      throw e;
    }
  });

  app.post("/login", async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await reply.status(401).send({ error: "invalid_credentials" });
      return;
    }
    const ok = await argon2.verify(user.passwordHash, parsed.data.password);
    if (!ok) {
      await reply.status(401).send({ error: "invalid_credentials" });
      return;
    }
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, status: "active" },
      orderBy: { createdAt: "asc" },
    });
    const orgId = membership?.organizationId;
    if (!orgId) {
      await reply.status(403).send({ error: "no_organization" });
      return;
    }
    await createSession(user.id, reply);
    await appendLoginAudit(user.id, orgId);
    await reply.send({
      user: { id: user.id, email: user.email },
    });
  });

  app.post("/logout", async (request, reply) => {
    await destroySession(request, reply);
    await reply.send({ ok: true });
  });
}
