import argon2 from "argon2";
import { prisma } from "../lib/prisma.js";
import { appendAudit } from "./audit.js";

export type RegisterInput = {
  email: string;
  password: string;
  organizationName: string;
};

export async function registerUserAndOrg(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash },
    });
    const org = await tx.organization.create({
      data: { name: input.organizationName.trim() },
    });
    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
        status: "active",
      },
    });

    const planCode = "trial";
    await tx.subscription.create({
      data: {
        organizationId: org.id,
        planCode,
        status: "trialing",
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        organizationId: org.id,
        kind: "personal",
        name: "Pessoal",
      },
    });

    return { user, organization: org, workspace };
  });

  await appendAudit({
    organizationId: result.organization.id,
    actorUserId: result.user.id,
    action: "auth.register",
    resourceType: "organization",
    resourceId: result.organization.id,
    metadata: {
      email: result.user.email,
      organizationId: result.organization.id,
      workspaceId: result.workspace.id,
    },
  });

  return result;
}
