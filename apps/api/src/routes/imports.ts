import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/require-auth.js";
import { requireOrgContext } from "../plugins/require-org.js";
import { getImportBatch, listImportBatches, runWorkspaceImport } from "../services/import-process.js";

function serializeBatch(b: {
  id: string;
  organizationId: string;
  workspaceId: string;
  targetAccountId: string;
  createdByUserId: string;
  originalFilename: string;
  contentSha256: string;
  byteSize: number;
  mimeType: string | null;
  storageKey: string;
  status: string;
  resultSummary: unknown;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: b.id,
    organizationId: b.organizationId,
    workspaceId: b.workspaceId,
    targetAccountId: b.targetAccountId,
    createdByUserId: b.createdByUserId,
    originalFilename: b.originalFilename,
    contentSha256: b.contentSha256,
    byteSize: b.byteSize,
    mimeType: b.mimeType,
    storageKey: b.storageKey,
    status: b.status,
    resultSummary: b.resultSummary,
    createdAt: b.createdAt.toISOString(),
    completedAt: b.completedAt?.toISOString() ?? null,
  };
}

export async function importsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/imports",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const q = request.query as { limit?: string; offset?: string };
      const limit = Number(q.limit ?? "50");
      const offset = Number(q.offset ?? "0");
      const rows = await listImportBatches({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        limit,
        offset,
      });
      if (!rows) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      await reply.send({ imports: rows.map((b) => serializeBatch(b)) });
    },
  );

  app.get<{ Params: { workspaceId: string; importId: string } }>(
    "/workspaces/:workspaceId/imports/:importId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const row = await getImportBatch({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        importId: request.params.importId,
      });
      if (!row) {
        await reply.status(404).send({ error: "import_not_found", message: "Import não encontrado." });
        return;
      }
      await reply.send({ importBatch: serializeBatch(row) });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/imports",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      let originalFilename = "upload";
      let fileBuffer: Buffer | null = null;
      let accountId: string | null = null;
      let templateId: string | undefined;

      try {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === "file") {
            if (part.fieldname === "file") {
              originalFilename = part.filename || "upload";
              fileBuffer = await part.toBuffer();
            }
          } else if (part.fieldname === "accountId") {
            accountId = String(part.value ?? "").trim() || null;
          } else if (part.fieldname === "templateId") {
            const v = String(part.value ?? "").trim();
            if (v) templateId = v;
          }
        }
      } catch {
        await reply.status(400).send({ error: "invalid_multipart", message: "Multipart inválido." });
        return;
      }

      if (!fileBuffer || !accountId) {
        await reply.status(400).send({ error: "invalid_multipart", message: "Campos file e accountId obrigatórios." });
        return;
      }

      const res = await runWorkspaceImport({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        originalFilename,
        bytes: fileBuffer,
        accountId,
        templateId,
      });

      if (!res.ok) {
        request.log.warn(
          {
            msg: "import_batch_rejected",
            organizationId: request.organizationId,
            workspaceId: request.params.workspaceId,
            targetAccountId: accountId,
            error: res.error,
          },
          "import rejected",
        );
        await reply.status(res.status).send({ error: res.error, message: res.message });
        return;
      }

      const batch = res.importBatch;
      const summary = batch.resultSummary as Record<string, unknown> | null | undefined;
      request.log.info(
        {
          msg: "import_batch_finished",
          organizationId: request.organizationId,
          workspaceId: batch.workspaceId,
          targetAccountId: batch.targetAccountId,
          importBatchId: batch.id,
          status: batch.status,
          inserted: summary?.inserted,
          skippedDuplicate: summary?.skippedDuplicate,
          parseErrors: summary?.parseErrors,
        },
        "import batch finished",
      );

      await reply.send({
        importBatch: serializeBatch(batch),
        resultSummary: batch.resultSummary,
      });
    },
  );
}
