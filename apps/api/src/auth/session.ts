import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";
import { generateSessionToken, hashSessionToken } from "../lib/crypto-token.js";
import { appendAudit } from "../services/audit.js";

export const SESSION_COOKIE = "mf_session";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

function cookieBase() {
  const secure = process.env.NODE_ENV === "production";
  return {
    path: "/",
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    maxAge: Math.floor(SESSION_MS / 1000),
  };
}

export async function createSession(
  userId: string,
  reply: FastifyReply,
): Promise<void> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });
  reply.setCookie(SESSION_COOKIE, token, cookieBase());
}

export async function destroySession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  if (token) {
    const tokenHash = hashSessionToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  reply.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true, sameSite: "lax" });
}

export async function resolveSessionUserId(
  request: FastifyRequest,
): Promise<string | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
  });
  return session?.userId ?? null;
}

export async function appendLoginAudit(
  userId: string,
  organizationId: string,
): Promise<void> {
  await appendAudit({
    organizationId,
    actorUserId: userId,
    action: "auth.login",
    resourceType: "user",
    resourceId: userId,
  });
}
