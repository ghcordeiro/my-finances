import { describe, expect, it } from "vitest";
import {
  clampDayOfMonth,
  closingInstantUtcForMonth,
  closingSequenceUtc,
  dueAtUtcForStatementEnd,
  installmentPeriodEndUtc,
  nextClosingInstantUtc,
} from "../billing-calendar.js";

describe("M2-T-002 billing-calendar", () => {
  it("clamp: dia 31 em abril → 30 (America/Sao_Paulo)", () => {
    expect(clampDayOfMonth(2026, 4, 31, "America/Sao_Paulo")).toBe(30);
    const close = closingInstantUtcForMonth(2026, 4, 31, "America/Sao_Paulo");
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(close);
    expect(local).toBe("2026-04-30");
  });

  it("sequência de fechamentos mensais é monótona crescente", () => {
    const anchor = new Date("2026-01-01T12:00:00.000Z");
    const seq = closingSequenceUtc(anchor, 10, "America/Sao_Paulo", 6);
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]!.getTime()).toBeGreaterThan(seq[i - 1]!.getTime());
    }
  });

  it("nextClosing após 31/01 com closing dia 31 → fevereiro com clamp (2026 não bissexto)", () => {
    const janClose = closingInstantUtcForMonth(2026, 1, 31, "America/Sao_Paulo");
    const next = nextClosingInstantUtc(janClose, 31, "America/Sao_Paulo");
    const d = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(next);
    expect(d).toBe("2026-02-28"); // 2026 não é bissexto → clamp 31 → 28
  });

  it("dueAt fica no mês seguinte ao fechamento civil", () => {
    const periodEnd = closingInstantUtcForMonth(2026, 3, 10, "America/Sao_Paulo");
    const due = dueAtUtcForStatementEnd(periodEnd, 7, "America/Sao_Paulo");
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(due);
    expect(parts).toBe("2026-04-07");
  });

  it("installmentPeriodEnd: parcela 1 e 12 com closing 10", () => {
    const purchasedAt = new Date("2026-03-05T15:00:00.000Z");
    const p1 = installmentPeriodEndUtc({
      purchasedAtUtc: purchasedAt,
      installmentIndex: 1,
      closingDay: 10,
      timeZone: "America/Sao_Paulo",
    });
    const p12 = installmentPeriodEndUtc({
      purchasedAtUtc: purchasedAt,
      installmentIndex: 12,
      closingDay: 10,
      timeZone: "America/Sao_Paulo",
    });
    expect(p12.getTime()).toBeGreaterThan(p1.getTime());
  });
});
