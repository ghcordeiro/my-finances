import { createHash, randomUUID } from "node:crypto";
import type { Account, ImportBatch } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { applyCsvTemplate, stableCsvRowFingerprint, type CsvColumnMap } from "../import/csv/apply-csv-template.js";
import { OfxInvalidFileError, parseOfxTransactionsFromBytes } from "../import/ofx/parse-ofx.js";
import { prisma } from "../lib/prisma.js";
import { loadWorkspaceInOrg } from "../lib/workspace-scope.js";
import { appendAudit } from "./audit.js";
import { assertValidColumnMap, getCsvTemplateInScope } from "./csv-templates.js";
import { finalizeImportBatchWithRetry, type ImportPostingRow } from "./import-apply.js";
import { buildImportObjectKey, putImportObject } from "./storage.js";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type ImportProcessFailure = {
  ok: false;
  status: number;
  error:
    | "duplicate_import"
    | "invalid_file"
    | "invalid_multipart"
    | "account_not_found"
    | "template_not_found"
    | "csv_template_required"
    | "import_too_many_lines"
    | "file_too_large"
    | "workspace_not_found";
  message?: string;
};

export type ImportProcessSuccess = { ok: true; importBatch: ImportBatch };

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function guessMime(ext: string): string | null {
  if (ext === ".ofx") return "application/x-ofx";
  if (ext === ".csv") return "text/csv";
  return null;
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function mapOfxRows(_account: Account, txs: ReturnType<typeof parseOfxTransactionsFromBytes>): ImportPostingRow[] {
  return txs.map((t) => ({
    amount: new Prisma.Decimal(t.trnamt),
    bookedAt: t.bookedAt,
    memo: [t.memo, t.name].filter(Boolean).join(" — ") || null,
    externalStableId:
      t.fitid?.trim() ||
      stableCsvRowFingerprint({
        bookedAt: t.bookedAt,
        amount: t.trnamt,
        memo: [t.memo, t.name].filter(Boolean).join(" "),
      }),
  }));
}

export async function runWorkspaceImport(input: {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  originalFilename: string;
  bytes: Buffer;
  accountId: string;
  templateId?: string;
}): Promise<ImportProcessSuccess | ImportProcessFailure> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) {
    return { ok: false, status: 404, error: "workspace_not_found", message: "Workspace não encontrado." };
  }
  if (ws.archivedAt) {
    return { ok: false, status: 404, error: "workspace_not_found", message: "Workspace arquivado." };
  }

  const account = await prisma.account.findFirst({
    where: {
      id: input.accountId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    },
  });
  if (!account || account.archivedAt) {
    return { ok: false, status: 404, error: "account_not_found", message: "Conta não encontrada." };
  }

  const ext = extOf(input.originalFilename);
  if (ext !== ".ofx" && ext !== ".csv") {
    return { ok: false, status: 400, error: "invalid_file", message: "Extensão não suportada." };
  }
  if (input.bytes.length > MAX_IMPORT_BYTES) {
    return { ok: false, status: 413, error: "file_too_large", message: "Ficheiro acima de 10 MiB." };
  }

  const hash = sha256Hex(input.bytes);
  const dup = await prisma.importBatch.findFirst({
    where: {
      workspaceId: input.workspaceId,
      targetAccountId: input.accountId,
      contentSha256: hash,
      status: { in: ["completed", "partial"] },
    },
  });
  if (dup) {
    return { ok: false, status: 409, error: "duplicate_import", message: "Este ficheiro já foi importado para esta conta." };
  }

  let parseErrors = 0;
  let rows: ImportPostingRow[] = [];

  if (ext === ".ofx") {
    try {
      const txs = parseOfxTransactionsFromBytes(input.bytes);
      rows = mapOfxRows(account, txs);
    } catch (e) {
      if (e instanceof OfxInvalidFileError) {
        return { ok: false, status: 400, error: "invalid_file", message: e.message };
      }
      throw e;
    }
  } else {
    if (!input.templateId) {
      return { ok: false, status: 422, error: "csv_template_required", message: "CSV requer templateId." };
    }
    const tpl = await getCsvTemplateInScope({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      templateId: input.templateId,
    });
    if (!tpl) {
      return { ok: false, status: 404, error: "template_not_found", message: "Template não encontrado." };
    }
    const map = tpl.columnMap;
    if (!assertValidColumnMap(map)) {
      return { ok: false, status: 400, error: "invalid_file", message: "columnMap inválido no template." };
    }
    const csvText = input.bytes.toString("utf-8");
    const headerLine = csvText.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
    const delimiter = headerLine.includes(";") ? ";" : ",";
    const applied = applyCsvTemplate(csvText, {
      columnMap: map as CsvColumnMap,
      dateFormat: tpl.dateFormat,
      decimalSeparator: tpl.decimalSeparator === "," ? "," : ".",
      timezone: tpl.timezone ?? undefined,
      delimiter,
    });
    if (applied.tooManyLines) {
      return { ok: false, status: 422, error: "import_too_many_lines", message: "Acima de 10 000 linhas de dados." };
    }
    for (const r of applied.rows) {
      if (!r.ok) {
        parseErrors += 1;
        continue;
      }
      rows.push({
        amount: new Prisma.Decimal(r.amount),
        bookedAt: r.bookedAt,
        memo: r.memo ?? null,
        externalStableId: r.externalStableId,
      });
    }
  }

  const batchId = randomUUID();
  const storageKey = buildImportObjectKey(
    input.organizationId,
    input.workspaceId,
    batchId,
    input.originalFilename,
  );
  const mimeType = guessMime(ext);

  const batch = await prisma.importBatch.create({
    data: {
      id: batchId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      targetAccountId: account.id,
      createdByUserId: input.actorUserId,
      originalFilename: input.originalFilename.slice(0, 400),
      contentSha256: hash,
      byteSize: input.bytes.length,
      mimeType,
      storageKey,
      status: "pending",
    },
  });

  await appendAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "import_batch_created",
    resourceType: "import_batch",
    resourceId: batch.id,
    metadata: {
      workspaceId: input.workspaceId,
      targetAccountId: account.id,
      byteSize: input.bytes.length,
    },
  });

  try {
    await putImportObject(storageKey, input.bytes, mimeType ?? undefined);
  } catch {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "failed", completedAt: new Date(), resultSummary: { error: "storage_put_failed" } },
    });
    await appendAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "import_batch_failed",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: { reason: "storage_put_failed" },
    });
    return {
      ok: false,
      status: 503,
      error: "invalid_file",
      message: "Armazenamento de objetos indisponível.",
    };
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "processing" },
  });

  try {
    await finalizeImportBatchWithRetry({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      importBatchId: batch.id,
      accountId: account.id,
      currency: account.currency.trim().toUpperCase(),
      rows,
      parseErrors,
    });
  } catch (e) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        resultSummary: { error: e instanceof Error ? e.message : "apply_failed" },
      },
    });
    await appendAudit({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "import_batch_failed",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: { reason: "apply_failed" },
    });
    throw e;
  }

  const updated = await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
  return { ok: true, importBatch: updated };
}

export async function listImportBatches(input: {
  organizationId: string;
  workspaceId: string;
  limit: number;
  offset: number;
}): Promise<ImportBatch[] | null> {
  const ws = await loadWorkspaceInOrg(input.organizationId, input.workspaceId);
  if (!ws) return null;
  return prisma.importBatch.findMany({
    where: { organizationId: input.organizationId, workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit, 1), 100),
    skip: Math.max(input.offset, 0),
  });
}

export async function getImportBatch(input: {
  organizationId: string;
  workspaceId: string;
  importId: string;
}): Promise<ImportBatch | null> {
  return prisma.importBatch.findFirst({
    where: {
      id: input.importId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
    },
  });
}
