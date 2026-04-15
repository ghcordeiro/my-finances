import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../plugins/require-auth.js";
import { requireOrgContext } from "../plugins/require-org.js";
import { createAccount, listAccountsForWorkspace, patchAccount } from "../services/accounts.js";

const createBody = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["checking", "investment"]),
  currency: z.string().min(3).max(8).optional(),
  initialBalance: z.union([z.number(), z.string()]).optional(),
});

const patchBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    archive: z.boolean().optional(),
  })
  .refine((b) => b.name !== undefined || b.archive !== undefined, {
    message: "name ou archive obrigatório",
  });

export async function accountsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/accounts",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const res = await listAccountsForWorkspace({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
      });
      if (!res) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      await reply.send({
        accounts: res.accounts.map((a) => ({
          id: a.id,
          workspaceId: a.workspaceId,
          organizationId: a.organizationId,
          name: a.name,
          type: a.type,
          currency: a.currency,
          initialBalance: new Prisma.Decimal(a.initialBalance).toFixed(2),
          currentBalance: a.currentBalance,
          archivedAt: a.archivedAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
      });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/accounts",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      try {
        const created = await createAccount({
          organizationId: request.organizationId!,
          workspaceId: request.params.workspaceId,
          actorUserId: request.sessionUserId!,
          name: parsed.data.name,
          type: parsed.data.type,
          currency: parsed.data.currency,
          initialBalance: parsed.data.initialBalance,
        });
        if (!created.ok) {
          if (created.reason === "workspace_not_found") {
            await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
            return;
          }
          await reply.status(422).send({
            error: "workspace_archived",
            message: "Workspace arquivado não aceita novas contas.",
          });
          return;
        }
        const a = created.account;
        await reply.status(201).send({
          account: {
            id: a.id,
            workspaceId: a.workspaceId,
            organizationId: a.organizationId,
            name: a.name,
            type: a.type,
            currency: a.currency,
            initialBalance: new Prisma.Decimal(a.initialBalance).toFixed(2),
            archivedAt: a.archivedAt?.toISOString() ?? null,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
          },
        });
      } catch (e: unknown) {
        if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "invalid_initial_balance") {
          await reply.status(422).send({ error: "invalid_initial_balance", message: "Saldo inicial inválido." });
          return;
        }
        throw e;
      }
    },
  );

  app.patch<{ Params: { workspaceId: string; accountId: string } }>(
    "/workspaces/:workspaceId/accounts/:accountId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const updated = await patchAccount({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        accountId: request.params.accountId,
        actorUserId: request.sessionUserId!,
        name: parsed.data.name,
        archive: parsed.data.archive,
      });
      if (!updated.ok) {
        if (updated.reason === "workspace_not_found") {
          await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
          return;
        }
        await reply.status(404).send({ error: "account_not_found", message: "Conta não encontrada." });
        return;
      }
      const a = updated.account;
      await reply.send({
        account: {
          id: a.id,
          workspaceId: a.workspaceId,
          organizationId: a.organizationId,
          name: a.name,
          type: a.type,
          currency: a.currency,
          initialBalance: new Prisma.Decimal(a.initialBalance).toFixed(2),
          archivedAt: a.archivedAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        },
      });
    },
  );
}
