import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { appendAuditTx } from "./audit.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type ImportPostingRow = {
  amount: Prisma.Decimal;
  bookedAt: Date;
  memo: string | null;
  externalStableId: string;
};

export type FinalizeImportBatchInput = {
  organizationId: string;
  workspaceId: string;
  actorUserId: string;
  importBatchId: string;
  accountId: string;
  currency: string;
  rows: ImportPostingRow[];
  parseErrors: number;
};

function resolveBatchStatus(input: {
  parseErrors: number;
  inserted: number;
  skippedDuplicate: number;
}): "completed" | "partial" {
  if (input.parseErrors > 0) return "partial";
  if (input.inserted > 0 && input.skippedDuplicate > 0) return "partial";
  return "completed";
}

/**
 * Insere postings com isolamento Serializable e retry em P2034 (ADR-0011 §5, alinhado a transfers M1).
 */
export async function finalizeImportBatchWithRetry(input: FinalizeImportBatchInput): Promise<{
  inserted: number;
  skippedDuplicate: number;
  status: "completed" | "partial";
}> {
  const backoff = [20, 50, 120];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = await prisma.$transaction(
        async (tx) => {
          let inserted = 0;
          let skippedDuplicate = 0;
          for (const row of input.rows) {
            await tx.$executeRawUnsafe("SAVEPOINT import_posting_row");
            try {
              await tx.accountImportPosting.create({
                data: {
                  organizationId: input.organizationId,
                  workspaceId: input.workspaceId,
                  accountId: input.accountId,
                  importBatchId: input.importBatchId,
                  amount: row.amount,
                  currency: input.currency,
                  bookedAt: row.bookedAt,
                  memo: row.memo,
                  externalStableId: row.externalStableId,
                },
              });
              inserted += 1;
              await tx.$executeRawUnsafe("RELEASE SAVEPOINT import_posting_row");
            } catch (e: unknown) {
              await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT import_posting_row");
              const msg = e instanceof Error ? e.message : "";
              if (msg.includes("Unique constraint failed")) {
                skippedDuplicate += 1;
              } else {
                throw e;
              }
            }
          }

          const status = resolveBatchStatus({
            parseErrors: input.parseErrors,
            inserted,
            skippedDuplicate,
          });

          await tx.importBatch.update({
            where: { id: input.importBatchId },
            data: {
              status,
              completedAt: new Date(),
              resultSummary: {
                inserted,
                skippedDuplicate,
                parseErrors: input.parseErrors,
              },
            },
          });

          await appendAuditTx(tx, {
            organizationId: input.organizationId,
            actorUserId: input.actorUserId,
            action: "import_batch_completed",
            resourceType: "import_batch",
            resourceId: input.importBatchId,
            metadata: {
              inserted,
              skippedDuplicate,
              parseErrors: input.parseErrors,
              status,
            },
          });

          return { inserted, skippedDuplicate, status };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 30_000,
        },
      );
      return out;
    } catch (e) {
      lastErr = e;
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code?: string }).code === "P2034" &&
        attempt < 2
      ) {
        await sleep(backoff[attempt] ?? 120);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
