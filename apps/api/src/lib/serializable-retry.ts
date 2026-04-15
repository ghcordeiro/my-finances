import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const backoff = [20, 50, 120];

/**
 * Executa `fn` numa transação serializável com até 3 tentativas em `P2034` (ADR-0007 / ADR-0009 §9).
 */
export async function withSerializableRetry<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15_000,
      });
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
