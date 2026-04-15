import { DateTime } from "luxon";

/** Último dia civil do mês no fuso `timeZone` (1–12). */
export function daysInMonth(year: number, month: number, timeZone: string): number {
  return DateTime.fromObject({ year, month, day: 1 }, { zone: timeZone }).daysInMonth ?? 31;
}

export function clampDayOfMonth(year: number, month: number, day: number, timeZone: string): number {
  const dim = daysInMonth(year, month, timeZone);
  return Math.min(Math.max(1, day), dim);
}

/**
 * Instante UTC do fim do dia civil de fechamento (closingDay clamped) no mês indicado.
 */
export function closingInstantUtcForMonth(
  year: number,
  month: number,
  closingDay: number,
  timeZone: string,
): Date {
  const day = clampDayOfMonth(year, month, closingDay, timeZone);
  const local = DateTime.fromObject(
    { year, month, day, hour: 23, minute: 59, second: 59, millisecond: 999 },
    { zone: timeZone },
  );
  return local.toUTC().toJSDate();
}

/**
 * Primeiro instante de fechamento (UTC) **estritamente posterior** a `afterUtc`.
 */
export function nextClosingInstantUtc(afterUtc: Date, closingDay: number, timeZone: string): Date {
  let probe = DateTime.fromJSDate(afterUtc, { zone: "utc" }).setZone(timeZone);
  for (let i = 0; i < 800; i++) {
    const close = closingInstantUtcForMonth(probe.year, probe.month, closingDay, timeZone);
    if (close.getTime() > afterUtc.getTime()) {
      return close;
    }
    probe = probe.plus({ months: 1 }).startOf("month");
  }
  throw new Error("nextClosingInstantUtc: limite de iterações");
}

/** Gera N fechamentos mensais consecutivos a partir do primeiro fechamento > `afterUtc`. */
export function closingSequenceUtc(afterUtc: Date, closingDay: number, timeZone: string, count: number): Date[] {
  const out: Date[] = [];
  let prev = afterUtc;
  for (let k = 0; k < count; k++) {
    const next = nextClosingInstantUtc(prev, closingDay, timeZone);
    if (out.length > 0 && next.getTime() <= out[out.length - 1]!.getTime()) {
      throw new Error("closingSequenceUtc: sequência não monótona");
    }
    out.push(next);
    prev = next;
  }
  return out;
}

/**
 * Vencimento: fim do dia civil `dueDay` (clamp) no mês **seguinte** ao mês civil de `periodEndUtc` no TZ do cartão.
 */
export function dueAtUtcForStatementEnd(periodEndUtc: Date, dueDay: number, timeZone: string): Date {
  const endLocal = DateTime.fromJSDate(periodEndUtc, { zone: "utc" }).setZone(timeZone);
  const target = endLocal.plus({ months: 1 }).startOf("month");
  const day = clampDayOfMonth(target.year, target.month, dueDay, timeZone);
  return DateTime.fromObject(
    { year: target.year, month: target.month, day, hour: 23, minute: 59, second: 59, millisecond: 999 },
    { zone: timeZone },
  )
    .toUTC()
    .toJSDate();
}

/** Início do dia civil de `instantUtc` no TZ do cartão. */
export function startOfCivilDayInZone(instantUtc: Date, timeZone: string): Date {
  const local = DateTime.fromJSDate(instantUtc, { zone: "utc" }).setZone(timeZone).startOf("day");
  return local.toUTC().toJSDate();
}

/**
 * `periodEnd` da fatura onde cai a parcela `installmentIndex` (1…N), dado o fechamento da parcela 1.
 * Parcela 1: primeiro `periodEnd` com fechamento >= data civil de compra (ADR-0009 §4).
 */
export function installmentPeriodEndUtc(input: {
  purchasedAtUtc: Date;
  installmentIndex: number;
  closingDay: number;
  timeZone: string;
}): Date {
  const { purchasedAtUtc, installmentIndex, closingDay, timeZone } = input;
  if (installmentIndex < 1) {
    throw new Error("installmentIndex deve ser >= 1");
  }
  const civilStart = startOfCivilDayInZone(purchasedAtUtc, timeZone);
  const firstClose = nextClosingInstantUtc(
    new Date(civilStart.getTime() - 1),
    closingDay,
    timeZone,
  );
  if (installmentIndex === 1) {
    return firstClose;
  }
  let prev = firstClose;
  for (let k = 2; k <= installmentIndex; k++) {
    prev = nextClosingInstantUtc(prev, closingDay, timeZone);
  }
  return prev;
}
