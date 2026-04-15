import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/require-auth.js";
import { requireOrgContext } from "../plugins/require-org.js";
import { createWorkspace, listWorkspaces, patchWorkspace } from "../services/workspaces.js";

const createBody = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["personal", "business"]),
});

const patchBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    archive: z.boolean().optional(),
  })
  .refine((b) => b.name !== undefined || b.archive !== undefined, {
    message: "name ou archive obrigatório",
  });

export async function workspacesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/workspaces",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const orgId = request.organizationId!;
      const rows = await listWorkspaces(orgId);
      await reply.send({
        workspaces: rows.map((w) => ({
          id: w.id,
          organizationId: w.organizationId,
          kind: w.kind,
          name: w.name,
          archivedAt: w.archivedAt?.toISOString() ?? null,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        })),
      });
    },
  );

  app.post(
    "/workspaces",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const orgId = request.organizationId!;
      const userId = request.sessionUserId!;
      try {
        const ws = await createWorkspace({
          organizationId: orgId,
          actorUserId: userId,
          name: parsed.data.name,
          kind: parsed.data.kind,
        });
        await reply.status(201).send({
          workspace: {
            id: ws.id,
            organizationId: ws.organizationId,
            kind: ws.kind,
            name: ws.name,
            archivedAt: ws.archivedAt?.toISOString() ?? null,
            createdAt: ws.createdAt.toISOString(),
            updatedAt: ws.updatedAt.toISOString(),
          },
        });
      } catch (e: unknown) {
        if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "workspace_limit_exceeded") {
          await reply.status(409).send({
            error: "workspace_limit_exceeded",
            message: "Limite de workspaces do plano excedido.",
          });
          return;
        }
        throw e;
      }
    },
  );

  app.patch<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      const updated = await patchWorkspace({
        organizationId: request.organizationId!,
        actorUserId: request.sessionUserId!,
        workspaceId: request.params.workspaceId,
        name: parsed.data.name,
        archive: parsed.data.archive,
      });
      if (!updated) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      await reply.send({
        workspace: {
          id: updated.id,
          organizationId: updated.organizationId,
          kind: updated.kind,
          name: updated.name,
          archivedAt: updated.archivedAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    },
  );
}
