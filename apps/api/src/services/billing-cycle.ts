import type { CreditCard, CreditCardStatement } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Prisma as PrismaNs } from "@prisma/client";
import { dueAtUtcForStatementEnd, installmentPeriodEndUtc, nextClosingInstantUtc } from "../domain/billing-calendar.js";
import { billingAsOf } from "../lib/billing-as-of.js";

type Tx = PrismaNs.TransactionClient;

type DbLike = Pick<PrismaNs.TransactionClient, "creditCardStatementLine">;

export async function createInitialOpenStatement(
  tx: Tx,
  card: Pick<CreditCard, "id" | "organizationId" | "closingDay" | "dueDay" | "timezone" | "createdAt">,
): Promise<CreditCardStatement> {
  const periodStart = card.createdAt;
  const periodEnd = nextClosingInstantUtc(new Date(periodStart.getTime() - 1), card.closingDay, card.timezone);
  const dueAt = dueAtUtcForStatementEnd(periodEnd, card.dueDay, card.timezone);
  return tx.creditCardStatement.create({
    data: {
      organizationId: card.organizationId,
      creditCardId: card.id,
      periodStart,
      periodEnd,
      dueAt,
      status: "open",
    },
  });
}

/** Garante que exista uma linha de extrato para o `periodEnd` alvo (projeção de parcelas). */
export async function ensureScheduledStatementForPeriodEnd(
  tx: Tx,
  card: CreditCard,
  periodEndUtc: Date,
): Promise<CreditCardStatement> {
  const existing = await tx.creditCardStatement.findFirst({
    where: {
      creditCardId: card.id,
      organizationId: card.organizationId,
      periodEnd: periodEndUtc,
    },
  });
  if (existing) {
    return existing;
  }

  const prior = await tx.creditCardStatement.findFirst({
    where: { creditCardId: card.id, periodEnd: { lt: periodEndUtc } },
    orderBy: { periodEnd: "desc" },
  });
  const periodStart = prior
    ? new Date(prior.periodEnd.getTime() + 1)
    : card.createdAt;
  const dueAt = dueAtUtcForStatementEnd(periodEndUtc, card.dueDay, card.timezone);

  return tx.creditCardStatement.create({
    data: {
      organizationId: card.organizationId,
      creditCardId: card.id,
      periodStart,
      periodEnd: periodEndUtc,
      dueAt,
      status: "scheduled",
    },
  });
}

/**
 * Fecha ciclos em atraso (lazy) até `asOf` cobrir a fatura `open` corrente.
 * Idempotente: se já atualizado, não duplica ciclos.
 */
export async function ensureStatementsCurrent(
  tx: Tx,
  card: CreditCard,
  asOfInput?: Date,
): Promise<void> {
  const asOf = asOfInput ?? billingAsOf();
  const { closingDay, timezone } = card;

  for (let guard = 0; guard < 400; guard++) {
    const openRow = await tx.creditCardStatement.findFirst({
      where: { creditCardId: card.id, status: "open" },
    });
    if (!openRow) {
      return;
    }
    if (asOf.getTime() <= openRow.periodEnd.getTime()) {
      return;
    }

    await tx.creditCardStatement.update({
      where: { id: openRow.id },
      data: { status: "closed", closedAt: openRow.periodEnd },
    });

    const nextEnd = nextClosingInstantUtc(openRow.periodEnd, closingDay, timezone);
    const scheduled = await tx.creditCardStatement.findFirst({
      where: {
        creditCardId: card.id,
        periodEnd: nextEnd,
        status: "scheduled",
      },
    });
    if (scheduled) {
      await tx.creditCardStatement.update({
        where: { id: scheduled.id },
        data: { status: "open" },
      });
      continue;
    }

    const existsNext = await tx.creditCardStatement.findFirst({
      where: { creditCardId: card.id, periodEnd: nextEnd },
    });
    if (existsNext) {
      if (existsNext.status !== "open") {
        await tx.creditCardStatement.update({ where: { id: existsNext.id }, data: { status: "open" } });
      }
      continue;
    }

    const periodStart = new Date(openRow.periodEnd.getTime() + 1);
    const dueAt = dueAtUtcForStatementEnd(nextEnd, card.dueDay, timezone);
    await tx.creditCardStatement.create({
      data: {
        organizationId: card.organizationId,
        creditCardId: card.id,
        periodStart,
        periodEnd: nextEnd,
        dueAt,
        status: "open",
      },
    });
  }
}

/** Soma algébrica das linhas em faturas não pagas (open, scheduled, closed ≠ paid). */
export async function getCommittedAmount(tx: DbLike, organizationId: string, creditCardId: string): Promise<Prisma.Decimal> {
  const agg = await tx.creditCardStatementLine.aggregate({
    where: {
      organizationId,
      statement: {
        creditCardId,
        NOT: { status: "paid" },
      },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

export function computeInstallmentAmounts(total: Prisma.Decimal, count: number): Prisma.Decimal[] {
  if (count < 1) {
    throw new Error("installmentCount deve ser >= 1");
  }
  if (count === 1) {
    return [total];
  }
  const out: Prisma.Decimal[] = [];
  const n = new Prisma.Decimal(count);
  const base = total.div(n).mul(100).floor().div(100);
  let acc = new Prisma.Decimal(0);
  for (let i = 0; i < count - 1; i++) {
    out.push(base);
    acc = acc.add(base);
  }
  out.push(total.sub(acc));
  return out;
}

export function installmentStatementEnds(
  purchasedAtUtc: Date,
  installmentCount: number,
  closingDay: number,
  timeZone: string,
): Date[] {
  const ends: Date[] = [];
  for (let k = 1; k <= installmentCount; k++) {
    ends.push(
      installmentPeriodEndUtc({
        purchasedAtUtc,
        installmentIndex: k,
        closingDay,
        timeZone,
      }),
    );
  }
  return ends;
}

export async function markStatementPaid(
  tx: Tx,
  input: { organizationId: string; creditCardId: string; statementId: string },
): Promise<"updated" | "noop" | "statement_not_found" | "statement_not_mutable"> {
  const row = await tx.creditCardStatement.findFirst({
    where: {
      id: input.statementId,
      organizationId: input.organizationId,
      creditCardId: input.creditCardId,
    },
  });
  if (!row) {
    return "statement_not_found";
  }
  if (row.status === "paid") {
    return "noop";
  }
  if (row.status !== "closed") {
    return "statement_not_mutable";
  }
  await tx.creditCardStatement.update({
    where: { id: row.id },
    data: { status: "paid", paidAt: billingAsOf() },
  });
  return "updated";
}
