import type { CsvImportTemplate } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { appendAudit } from "./audit.js";
import { loadWorkspaceInOrg } from "../lib/workspace-scope.js";
import type { CsvColumnMap } from "../import/csv/apply-csv-template.js";

export function assertValidColumnMap(map: unknown): map is CsvColumnMap {
  if (!map || typeof map !== "object") return false;
  const m = map as Record<string, unknown>;
  if (typeof m.date !== "string" || typeof m.description !== "string") return false;
  const hasAmount = typeof m.amount === "string";
  const hasPair = typeof m.debit === "string" && typeof m.credit === "string";
  return hasAmount || hasPair;
}

export async function listCsvTemplates(input: {
  organizationId: string;
  workspaceId: string;
  scope?: "workspace" | "organization" | "all";
}): Promise<{ ok: true; templates: CsvImportTemplate[] } | { ok: false; reason: "workspace_not_found" }> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) return { ok: false, reason: "workspace_not_found" };
  const scope = input.scope ?? "all";
  const where: Prisma.CsvImportTemplateWhereInput = { organizationId: input.organizationId };
  if (scope === "workspace") {
    where.workspaceId = input.workspaceId;
  } else if (scope === "organization") {
    where.workspaceId = null;
  } else {
    where.OR = [{ workspaceId: null }, { workspaceId: input.workspaceId }];
  }
  const templates = await prisma.csvImportTemplate.findMany({
    where,
    orderBy: [{ name: "asc" }],
  });
  return { ok: true, templates };
}

export async function createCsvTemplate(input: {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  name: string;
  columnMap: CsvColumnMap;
  dateFormat: string;
  decimalSeparator: "," | ".";
  timezone?: string | null;
  scope: "workspace" | "organization";
}): Promise<
  | { ok: true; template: CsvImportTemplate }
  | { ok: false; reason: "workspace_not_found" | "forbidden" }
  | { ok: false; reason: "name_conflict" }
> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) return { ok: false, reason: "workspace_not_found" };

  if (input.scope === "organization") {
    const m = await prisma.membership.findFirst({
      where: { userId: input.actorUserId, organizationId: input.organizationId, status: "active" },
    });
    if (m?.role !== "owner") {
      return { ok: false, reason: "forbidden" };
    }
  }

  const workspaceId = input.scope === "organization" ? null : input.workspaceId;

  try {
    const template = await prisma.csvImportTemplate.create({
      data: {
        organizationId: input.organizationId,
        workspaceId,
        name: input.name.trim(),
        columnMap: input.columnMap as Prisma.InputJsonValue,
        dateFormat: input.dateFormat,
        decimalSeparator: input.decimalSeparator,
        timezone: input.timezone?.trim() || null,
      },
    });
    await appendAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "csv_template_created",
      resourceType: "csv_import_template",
      resourceId: template.id,
      metadata: { workspaceId: template.workspaceId, name: template.name },
    });
    return { ok: true, template };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, reason: "name_conflict" };
    }
    throw e;
  }
}

export async function getCsvTemplateInScope(input: {
  organizationId: string;
  workspaceId: string;
  templateId: string;
}): Promise<CsvImportTemplate | null> {
  const t = await prisma.csvImportTemplate.findFirst({
    where: {
      id: input.templateId,
      organizationId: input.organizationId,
      OR: [{ workspaceId: null }, { workspaceId: input.workspaceId }],
    },
  });
  return t;
}

export async function patchCsvTemplate(input: {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  templateId: string;
  name?: string;
  columnMap?: CsvColumnMap;
  dateFormat?: string;
  decimalSeparator?: "," | ".";
  timezone?: string | null;
}): Promise<
  | { ok: true; template: CsvImportTemplate }
  | { ok: false; reason: "template_not_found" | "name_conflict" }
> {
  const existing = await prisma.csvImportTemplate.findFirst({
    where: {
      id: input.templateId,
      organizationId: input.organizationId,
      OR: [{ workspaceId: null }, { workspaceId: input.workspaceId }],
    },
  });
  if (!existing) return { ok: false, reason: "template_not_found" };
  if (existing.workspaceId !== null && existing.workspaceId !== input.workspaceId) {
    return { ok: false, reason: "template_not_found" };
  }

  try {
    const template = await prisma.csvImportTemplate.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.columnMap !== undefined ? { columnMap: input.columnMap as Prisma.InputJsonValue } : {}),
        ...(input.dateFormat !== undefined ? { dateFormat: input.dateFormat } : {}),
        ...(input.decimalSeparator !== undefined ? { decimalSeparator: input.decimalSeparator } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone?.trim() || null } : {}),
      },
    });
    await appendAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "csv_template_updated",
      resourceType: "csv_import_template",
      resourceId: template.id,
      metadata: { name: template.name },
    });
    return { ok: true, template };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, reason: "name_conflict" };
    }
    throw e;
  }
}

export async function deleteCsvTemplate(input: {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  templateId: string;
}): Promise<{ ok: true } | { ok: false; reason: "template_not_found" }> {
  const existing = await prisma.csvImportTemplate.findFirst({
    where: {
      id: input.templateId,
      organizationId: input.organizationId,
      OR: [{ workspaceId: null }, { workspaceId: input.workspaceId }],
    },
  });
  if (!existing) return { ok: false, reason: "template_not_found" };
  if (existing.workspaceId !== null && existing.workspaceId !== input.workspaceId) {
    return { ok: false, reason: "template_not_found" };
  }

  await prisma.csvImportTemplate.delete({ where: { id: existing.id } });
  await appendAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "csv_template_deleted",
    resourceType: "csv_import_template",
    resourceId: existing.id,
    metadata: { name: existing.name },
  });
  return { ok: true };
}
