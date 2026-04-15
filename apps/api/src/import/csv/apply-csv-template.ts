import { createHash } from "node:crypto";
import { DateTime } from "luxon";

/** Máximo de linhas de dados (exclui cabeçalho), alinhado ao plano M3 §7. */
export const CSV_IMPORT_MAX_DATA_LINES = 10_000;

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const MEMO_FINGERPRINT_MAX = 120;

export type CsvDecimalSeparator = "," | ".";

/** Mapeia chaves lógicas para nomes de coluna no CSV (cabeçalho). */
export type CsvColumnMap = {
  date: string;
  description: string;
  memo?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  /** Coluna opcional com identificador estável do extrato (quando ausente, usa-se fingerprint). */
  externalId?: string;
};

export type ApplyCsvTemplateInput = {
  columnMap: CsvColumnMap;
  dateFormat: string;
  decimalSeparator: CsvDecimalSeparator;
  /** IANA; omissão = `America/Sao_Paulo` (plan #8). */
  timezone?: string;
  /** Separador de campo; omissão = `,`. */
  delimiter?: string;
};

export type CsvTemplateRowOk = {
  ok: true;
  /** Linha de dados 1-based (1 = primeira linha após o cabeçalho). */
  lineNumber: number;
  amount: string;
  bookedAt: Date;
  description: string;
  memo?: string;
  externalStableId: string;
};

export type CsvTemplateRowErr = {
  ok: false;
  lineNumber: number;
  errors: string[];
};

export type CsvTemplateRowResult = CsvTemplateRowOk | CsvTemplateRowErr;

export type ApplyCsvTemplateResult = {
  rows: CsvTemplateRowResult[];
  /** `true` quando existem mais de {@link CSV_IMPORT_MAX_DATA_LINES} linhas de dados. */
  tooManyLines: boolean;
  /** Linhas de dados processadas ou contadas até ao limite. */
  dataLineCount: number;
};

function assertColumnMap(map: CsvColumnMap): void {
  const hasAmount = Boolean(map.amount);
  const hasDebitCredit = Boolean(map.debit && map.credit);
  if (!hasAmount && !hasDebitCredit) {
    throw new Error("column_map_requires_amount_or_debit_credit");
  }
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i]!;
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (!inQuotes && line.slice(i, i + delimiter.length) === delimiter) {
      out.push(field.trim());
      field = "";
      i += delimiter.length;
      continue;
    }
    field += c;
    i += 1;
  }
  out.push(field.trim());
  return out;
}

function resolveHeaderIndex(headers: string[], wanted: string): number {
  const t = wanted.trim();
  const exact = headers.findIndex((h) => h.trim() === t);
  if (exact !== -1) return exact;
  const lower = t.toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === lower);
}

function normalizeDecimalString(raw: string, decimalSeparator: CsvDecimalSeparator): string {
  let s = raw.trim();
  if (!s) {
    throw new Error("empty_amount");
  }
  if (decimalSeparator === ",") {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error("invalid_amount");
  }
  return s;
}

function parseSignedAmountFromDebitCredit(
  debitRaw: string,
  creditRaw: string,
  decimalSeparator: CsvDecimalSeparator,
): string {
  const d = debitRaw.trim() === "" ? "0" : normalizeDecimalString(debitRaw, decimalSeparator);
  const c = creditRaw.trim() === "" ? "0" : normalizeDecimalString(creditRaw, decimalSeparator);
  const debit = Number(d);
  const credit = Number(c);
  if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
    throw new Error("invalid_debit_credit");
  }
  if (debit < 0 || credit < 0) {
    throw new Error("debit_credit_must_be_non_negative");
  }
  const net = credit - debit;
  return net.toFixed(2);
}

/**
 * Fingerprint estável por linha quando não há coluna `externalId` (ADR-0011 §3).
 * SHA256 de `bookedAtIsoUtcSegundos|amount(2 decimais)|memoNormalizado` com memo truncado a 120 chars.
 */
export function stableCsvRowFingerprint(input: {
  bookedAt: Date;
  amount: string;
  memo?: string;
}): string {
  const iso = input.bookedAt.toISOString().slice(0, 19) + "Z";
  const amountNum = Number(input.amount);
  const amountFixed = Number.isFinite(amountNum) ? amountNum.toFixed(2) : input.amount;
  const memo = (input.memo ?? "").normalize("NFKC").trim().slice(0, MEMO_FINGERPRINT_MAX);
  const payload = `${iso}|${amountFixed}|${memo}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function parseBookedAt(
  raw: string,
  dateFormat: string,
  timezone: string,
): { bookedAt: Date } | { error: string } {
  const zone = timezone || DEFAULT_TIMEZONE;
  const local = DateTime.fromFormat(raw.trim(), dateFormat, { zone });
  if (!local.isValid) {
    return { error: "invalid_date" };
  }
  return { bookedAt: local.toUTC().toJSDate() };
}

export function applyCsvTemplate(csvText: string, input: ApplyCsvTemplateInput): ApplyCsvTemplateResult {
  assertColumnMap(input.columnMap);
  const delimiter = input.delimiter ?? ",";
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { rows: [], tooManyLines: false, dataLineCount: 0 };
  }
  const headerCells = splitCsvLine(lines[0]!, delimiter);
  const headers = headerCells.map((h) => h.trim());

  const idxDate = resolveHeaderIndex(headers, input.columnMap.date);
  const idxDesc = resolveHeaderIndex(headers, input.columnMap.description);
  const idxMemo = input.columnMap.memo ? resolveHeaderIndex(headers, input.columnMap.memo) : -1;
  const idxAmount = input.columnMap.amount ? resolveHeaderIndex(headers, input.columnMap.amount) : -1;
  const idxDebit = input.columnMap.debit ? resolveHeaderIndex(headers, input.columnMap.debit) : -1;
  const idxCredit = input.columnMap.credit ? resolveHeaderIndex(headers, input.columnMap.credit) : -1;
  const idxExt = input.columnMap.externalId ? resolveHeaderIndex(headers, input.columnMap.externalId) : -1;

  const missing: string[] = [];
  if (idxDate === -1) missing.push("date");
  if (idxDesc === -1) missing.push("description");
  if (input.columnMap.memo && idxMemo === -1) missing.push("memo");
  if (input.columnMap.amount && idxAmount === -1) missing.push("amount");
  if (input.columnMap.debit && idxDebit === -1) missing.push("debit");
  if (input.columnMap.credit && idxCredit === -1) missing.push("credit");
  if (input.columnMap.externalId && idxExt === -1) missing.push("externalId");
  if (missing.length > 0) {
    throw new Error(`missing_columns:${missing.join(",")}`);
  }

  const rows: CsvTemplateRowResult[] = [];
  let tooManyLines = false;
  let dataLineCount = 0;

  for (let li = 1; li < lines.length; li += 1) {
    const lineNumber = li;
    const line = lines[li]!;
    if (line.trim() === "") {
      continue;
    }
    dataLineCount += 1;
    if (dataLineCount > CSV_IMPORT_MAX_DATA_LINES) {
      tooManyLines = true;
      break;
    }
    const cells = splitCsvLine(line, delimiter);
    const errors: string[] = [];

    const dateRaw = cells[idxDate] ?? "";
    const descRaw = cells[idxDesc] ?? "";
    const memoRaw = idxMemo === -1 ? undefined : cells[idxMemo];
    const extRaw = idxExt === -1 ? undefined : cells[idxExt];

    const booked = parseBookedAt(dateRaw, input.dateFormat, timezone);
    if ("error" in booked) {
      errors.push(booked.error);
    }
    let amountStr: string | undefined;
    try {
      if (input.columnMap.amount && idxAmount !== -1) {
        amountStr = normalizeDecimalString(cells[idxAmount] ?? "", input.decimalSeparator);
      } else if (input.columnMap.debit && input.columnMap.credit) {
        amountStr = parseSignedAmountFromDebitCredit(
          cells[idxDebit] ?? "",
          cells[idxCredit] ?? "",
          input.decimalSeparator,
        );
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "amount_error");
    }

    if (!descRaw.trim()) {
      errors.push("empty_description");
    }

    if (errors.length > 0) {
      rows.push({ ok: false, lineNumber, errors });
      continue;
    }

    if (!("bookedAt" in booked)) {
      rows.push({ ok: false, lineNumber, errors: ["invalid_date"] });
      continue;
    }
    const bookedAt = booked.bookedAt;
    if (amountStr === undefined) {
      rows.push({ ok: false, lineNumber, errors: ["missing_amount"] });
      continue;
    }
    const description = descRaw.trim();
    const memo = memoRaw?.trim() ? memoRaw.trim() : undefined;
    const ext = extRaw?.trim();
    const externalStableId =
      ext && ext.length > 0 ? ext : stableCsvRowFingerprint({ bookedAt, amount: amountStr, memo });

    rows.push({
      ok: true,
      lineNumber,
      amount: amountStr,
      bookedAt,
      description,
      memo,
      externalStableId,
    });
  }

  return { rows, tooManyLines, dataLineCount };
}
