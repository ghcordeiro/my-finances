import { describe, expect, it } from "vitest";
import {
  CSV_IMPORT_MAX_DATA_LINES,
  applyCsvTemplate,
  stableCsvRowFingerprint,
} from "../apply-csv-template.js";

describe("M3-T-003 apply CSV template", () => {
  it("mapeia dateFormat + vírgula decimal + timezone SP → amount, bookedAt UTC, description, fingerprint", () => {
    const csv = ["Data;Movimento;Valor", "15/01/2024;Almoço;-12,50", "20/01/2024;Café;5,00"].join("\n");

    const { rows, tooManyLines, dataLineCount } = applyCsvTemplate(csv, {
      columnMap: { date: "Data", description: "Movimento", amount: "Valor" },
      dateFormat: "dd/MM/yyyy",
      decimalSeparator: ",",
      delimiter: ";",
      timezone: "America/Sao_Paulo",
    });

    expect(tooManyLines).toBe(false);
    expect(dataLineCount).toBe(2);
    expect(rows).toHaveLength(2);

    const r0 = rows[0];
    const r1 = rows[1];
    expect(r0?.ok).toBe(true);
    expect(r1?.ok).toBe(true);
    if (!r0?.ok || !r1?.ok) return;

    expect(r0.amount).toBe("-12.50");
    expect(r0.description).toBe("Almoço");
    expect(r0.bookedAt.toISOString()).toBe("2024-01-15T03:00:00.000Z");

    expect(r1.amount).toBe("5.00");
    expect(r1.description).toBe("Café");
    expect(r1.bookedAt.toISOString()).toBe("2024-01-20T03:00:00.000Z");

    expect(r0.externalStableId).toMatch(/^[a-f0-9]{64}$/);
    expect(r1.externalStableId).toMatch(/^[a-f0-9]{64}$/);
    expect(r0.externalStableId).not.toBe(r1.externalStableId);
  });

  it("suporta par débito/crédito (valores não negativos → amount = crédito − débito)", () => {
    const csv = ["data;desc;deb;cre", "01/02/2024;Pix;10,00;0", "02/02/2024;Salário;0;3500,55"].join("\n");
    const { rows } = applyCsvTemplate(csv, {
      columnMap: {
        date: "data",
        description: "desc",
        debit: "deb",
        credit: "cre",
      },
      dateFormat: "dd/MM/yyyy",
      decimalSeparator: ",",
      delimiter: ";",
    });
    expect(rows).toHaveLength(2);
    const a = rows[0];
    const b = rows[1];
    expect(a?.ok).toBe(true);
    expect(b?.ok).toBe(true);
    if (!a?.ok || !b?.ok) return;
    expect(a.amount).toBe("-10.00");
    expect(b.amount).toBe("3500.55");
  });

  it("usa coluna externalId quando preenchida", () => {
    const csv = ["Data;Hist;Valor;Ref", "10/03/2024;Compra;1,00;ABC-999"].join("\n");
    const { rows } = applyCsvTemplate(csv, {
      columnMap: {
        date: "Data",
        description: "Hist",
        amount: "Valor",
        externalId: "Ref",
      },
      dateFormat: "dd/MM/yyyy",
      decimalSeparator: ",",
      delimiter: ";",
    });
    const r = rows[0];
    expect(r?.ok).toBe(true);
    if (!r?.ok) return;
    expect(r.externalStableId).toBe("ABC-999");
  });

  it("acumula erros por linha sem interromper as seguintes", () => {
    const csv = ["Data;Desc;Valor", "99/99/2024;X;1,00", "11/04/2026;OK;2,00"].join("\n");
    const { rows } = applyCsvTemplate(csv, {
      columnMap: { date: "Data", description: "Desc", amount: "Valor" },
      dateFormat: "dd/MM/yyyy",
      decimalSeparator: ",",
      delimiter: ";",
    });
    expect(rows[0]?.ok).toBe(false);
    expect(rows[1]?.ok).toBe(true);
    if (rows[0]?.ok !== false) return;
    expect(rows[0].errors).toContain("invalid_date");
  });

  it("marca tooManyLines quando há mais de 10k linhas de dados", () => {
    const header = "d;h;v";
    const body = `${"01/01/2024;A;1,00\n".repeat(CSV_IMPORT_MAX_DATA_LINES)}`;
    const over = `${header}\n${body}01/01/2024;B;2,00\n`;
    const res = applyCsvTemplate(over, {
      columnMap: { date: "d", description: "h", amount: "v" },
      dateFormat: "dd/MM/yyyy",
      decimalSeparator: ",",
      delimiter: ";",
    });
    expect(res.tooManyLines).toBe(true);
    expect(res.dataLineCount).toBe(CSV_IMPORT_MAX_DATA_LINES + 1);
    expect(res.rows.length).toBe(CSV_IMPORT_MAX_DATA_LINES);
  });

  it("fingerprint dourado determinístico (payload canónico ADR-0011 §3)", () => {
    const bookedAt = new Date("2024-05-10T15:30:00.000Z");
    const fp = stableCsvRowFingerprint({ bookedAt, amount: "10.20", memo: "memo-fixo" });
    expect(fp).toBe("a30fc0538964f9685bbb74fedbea059f5369a934ada0f81196176e79fe7c7ffa");
  });

  it("trunca memo a 120 chars após NFKC antes do hash", () => {
    const bookedAt = new Date("2024-01-01T00:00:00.000Z");
    const long = `${"a".repeat(130)}é`;
    const fpLong = stableCsvRowFingerprint({ bookedAt, amount: "1.00", memo: long });
    const truncated = long.normalize("NFKC").trim().slice(0, 120);
    const fpTrunc = stableCsvRowFingerprint({ bookedAt, amount: "1.00", memo: truncated });
    expect(fpLong).toBe(fpTrunc);
  });
});
