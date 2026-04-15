import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../plugins/require-auth.js";
import { requireOrgContext } from "../plugins/require-org.js";
import {
  createTransfer,
  listTransfersForWorkspace,
  type CreateTransferError,
} from "../services/transfers.js";

const postBody = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.union([z.number().positive(), z.string()]),
  currency: z.string().min(3).max(8),
  bookedAt: z.string().datetime(),
  memo: z.string().max(500).optional(),
});

function transferStatusForError(err: CreateTransferError): {
  status: number;
  error: string;
  message: string;
} {
  switch (err) {
    case "account_not_found":
      return { status: 404, error: "account_not_found", message: "Conta não encontrada." };
    case "same_account":
      return { status: 422, error: "same_account", message: "Origem e destino não podem ser a mesma conta." };
    case "invalid_amount":
      return { status: 422, error: "invalid_amount", message: "Valor inválido." };
    case "account_archived":
      return { status: 422, error: "account_archived", message: "Conta arquivada ou indisponível." };
    case "currency_mismatch":
      return { status: 422, error: "currency_mismatch", message: "Moeda não coincide com as contas." };
    case "organization_mismatch":
      return { status: 422, error: "organization_mismatch", message: "Contas não pertencem à organização." };
    case "transfer_workspace_kind_not_allowed":
      return {
        status: 422,
        error: "transfer_workspace_kind_not_allowed",
        message: "Transferência não permitida entre estes workspaces.",
      };
    default:
      return { status: 422, error: err, message: "Operação inválida." };
  }
}

export async function transfersRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/transfers",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = postBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const amount = new Prisma.Decimal(parsed.data.amount.toString());
      const result = await createTransfer({
        organizationId: request.organizationId!,
        actorUserId: request.sessionUserId!,
        fromAccountId: parsed.data.fromAccountId,
        toAccountId: parsed.data.toAccountId,
        amount,
        currency: parsed.data.currency,
        bookedAt: new Date(parsed.data.bookedAt),
        memo: parsed.data.memo,
      });
      if (!result.ok) {
        const { status, error, message } = transferStatusForError(result.error);
        await reply.status(status).send({ error, message });
        return;
      }
      const t = result.transfer;
      await reply.status(201).send({
        transfer: {
          id: t.id,
          organizationId: t.organizationId,
          fromAccountId: t.fromAccountId,
          toAccountId: t.toAccountId,
          amount: new Prisma.Decimal(t.amount).toFixed(2),
          currency: t.currency,
          bookedAt: t.bookedAt.toISOString(),
          memo: t.memo,
          createdAt: t.createdAt.toISOString(),
        },
      });
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/transfers",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const rows = await listTransfersForWorkspace({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
      });
      if (rows === null) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      await reply.send({
        transfers: rows.map((t) => ({
          id: t.id,
          organizationId: t.organizationId,
          fromAccountId: t.fromAccountId,
          toAccountId: t.toAccountId,
          amount: new Prisma.Decimal(t.amount).toFixed(2),
          currency: t.currency,
          bookedAt: t.bookedAt.toISOString(),
          memo: t.memo,
          createdAt: t.createdAt.toISOString(),
        })),
      });
    },
  );
}
