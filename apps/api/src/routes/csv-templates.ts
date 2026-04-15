import type { CsvImportTemplate } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../plugins/require-auth.js";
import { requireOrgContext } from "../plugins/require-org.js";
import {
  assertValidColumnMap,
  createCsvTemplate,
  deleteCsvTemplate,
  listCsvTemplates,
  patchCsvTemplate,
} from "../services/csv-templates.js";

const columnMapSchema = z
  .object({
    date: z.string().min(1),
    description: z.string().min(1),
    memo: z.string().optional(),
    amount: z.string().optional(),
    debit: z.string().optional(),
    credit: z.string().optional(),
    externalId: z.string().optional(),
  })
  .passthrough()
  .superRefine((m, ctx) => {
    const hasAmount = typeof m.amount === "string";
    const hasPair = typeof m.debit === "string" && typeof m.credit === "string";
    if (!hasAmount && !hasPair) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "amount ou debit+credit obrigatório" });
    }
  });

const createBody = z.object({
  name: z.string().min(1).max(120),
  columnMap: columnMapSchema,
  dateFormat: z.string().min(1).max(80),
  decimalSeparator: z.enum([",", "."]),
  timezone: z.string().max(120).optional().nullable(),
  scope: z.enum(["workspace", "organization"]).default("workspace"),
});

const patchBody = z
  .object({
    name: z.string().min(1).max(120).optional(),
    columnMap: columnMapSchema.optional(),
    dateFormat: z.string().min(1).max(80).optional(),
    decimalSeparator: z.enum([",", "."]).optional(),
    timezone: z.string().max(120).optional().nullable(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "corpo vazio" });

function serializeTemplate(t: CsvImportTemplate) {
  return {
    id: t.id,
    organizationId: t.organizationId,
    workspaceId: t.workspaceId,
    name: t.name,
    columnMap: t.columnMap,
    dateFormat: t.dateFormat,
    decimalSeparator: t.decimalSeparator,
    timezone: t.timezone,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function csvTemplatesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/csv-templates",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const q = request.query as { scope?: string };
      const scope = q.scope === "workspace" || q.scope === "organization" || q.scope === "all" ? q.scope : "all";
      const rows = await listCsvTemplates({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        scope,
      });
      if (!rows.ok) {
        await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
        return;
      }
      await reply.send({
        templates: rows.templates.map((t) => serializeTemplate(t)),
      });
    },
  );

  app.post<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/csv-templates",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = createBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      if (!assertValidColumnMap(parsed.data.columnMap)) {
        await reply.status(400).send({ error: "validation_error", message: "columnMap inválido." });
        return;
      }
      const created = await createCsvTemplate({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        name: parsed.data.name,
        columnMap: parsed.data.columnMap,
        dateFormat: parsed.data.dateFormat,
        decimalSeparator: parsed.data.decimalSeparator,
        timezone: parsed.data.timezone ?? null,
        scope: parsed.data.scope,
      });
      if (!created.ok) {
        if (created.reason === "workspace_not_found") {
          await reply.status(404).send({ error: "workspace_not_found", message: "Workspace não encontrado." });
          return;
        }
        if (created.reason === "forbidden") {
          await reply.status(403).send({ error: "forbidden", message: "Apenas owner pode criar template a nível de organização." });
          return;
        }
        await reply.status(409).send({ error: "template_name_conflict", message: "Nome de template já existe." });
        return;
      }
      await reply.status(201).send({ template: serializeTemplate(created.template) });
    },
  );

  app.patch<{ Params: { workspaceId: string; templateId: string } }>(
    "/workspaces/:workspaceId/csv-templates/:templateId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: "validation_error", details: parsed.error.flatten() });
        return;
      }
      if (parsed.data.columnMap && !assertValidColumnMap(parsed.data.columnMap)) {
        await reply.status(400).send({ error: "validation_error", message: "columnMap inválido." });
        return;
      }
      const updated = await patchCsvTemplate({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        templateId: request.params.templateId,
        name: parsed.data.name,
        columnMap: parsed.data.columnMap,
        dateFormat: parsed.data.dateFormat,
        decimalSeparator: parsed.data.decimalSeparator,
        timezone: parsed.data.timezone,
      });
      if (!updated.ok) {
        if (updated.reason === "template_not_found") {
          await reply.status(404).send({ error: "template_not_found", message: "Template não encontrado." });
          return;
        }
        await reply.status(409).send({ error: "template_name_conflict", message: "Nome de template já existe." });
        return;
      }
      await reply.send({ template: serializeTemplate(updated.template) });
    },
  );

  app.delete<{ Params: { workspaceId: string; templateId: string } }>(
    "/workspaces/:workspaceId/csv-templates/:templateId",
    { preHandler: [requireAuth, requireOrgContext] },
    async (request, reply) => {
      const del = await deleteCsvTemplate({
        organizationId: request.organizationId!,
        workspaceId: request.params.workspaceId,
        actorUserId: request.sessionUserId!,
        templateId: request.params.templateId,
      });
      if (!del.ok) {
        await reply.status(404).send({ error: "template_not_found", message: "Template não encontrado." });
        return;
      }
      await reply.status(204).send();
    },
  );
}
