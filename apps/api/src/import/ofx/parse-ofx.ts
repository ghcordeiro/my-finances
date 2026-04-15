import { DateTime } from "luxon";

const DEFAULT_OFX_TIMEZONE = "America/Sao_Paulo";

export class OfxInvalidFileError extends Error {
  readonly code = "invalid_file" as const;
  constructor(message: string) {
    super(message);
    this.name = "OfxInvalidFileError";
  }
}

export type OfxNormalizedTransaction = {
  /** Valor assinado tal como no OFX (string decimal). */
  trnamt: string;
  /** Data/hora publicada normalizada `YYYYMMDD` ou `YYYYMMDDHHmmss` (sem sufixos OFX). */
  dtposted: string;
  fitid?: string;
  memo?: string;
  name?: string;
  /** `DTPOSTED` interpretado em `America/Sao_Paulo` quando sem offset explícito, em UTC. */
  bookedAt: Date;
};

function stripOfxBrackets(value: string): string {
  return value.replace(/\[.*$/, "").trim();
}

function normalizeDtpostedRaw(raw: string): string {
  const base = stripOfxBrackets(raw).replace(/\D/g, "");
  if (base.length >= 14) return base.slice(0, 14);
  if (base.length >= 8) return base.slice(0, 8);
  return base;
}

function parseBookedAtUtc(dtpostedRaw: string): Date {
  const norm = normalizeDtpostedRaw(dtpostedRaw);
  if (norm.length < 8) {
    throw new OfxInvalidFileError("invalid_dtposted");
  }
  const zone = DEFAULT_OFX_TIMEZONE;
  let local: DateTime;
  if (norm.length >= 14) {
    local = DateTime.fromFormat(norm.slice(0, 14), "yyyyMMddHHmmss", { zone });
  } else {
    local = DateTime.fromFormat(norm.slice(0, 8), "yyyyMMdd", { zone }).startOf("day");
  }
  if (!local.isValid) {
    throw new OfxInvalidFileError("invalid_dtposted");
  }
  return local.toUTC().toJSDate();
}

function readTagBlock(block: string, tag: string): string | undefined {
  const upper = tag.toUpperCase();
  const reSgml = new RegExp(`<${upper}>\\s*([^<\\r\\n]*)`, "i");
  const m1 = block.match(reSgml);
  if (m1?.[1] !== undefined) {
    const v = m1[1].trim();
    if (v.length > 0) return v;
  }
  const reXml = new RegExp(`<${upper}>\\s*([^<]+)</${upper}>`, "i");
  const m2 = block.match(reXml);
  return m2?.[1]?.trim();
}

function validateOfxEnvelope(text: string): void {
  const head = text.slice(0, Math.min(text.length, 400)).toUpperCase();
  if (head.includes("OFXHEADER:") || head.includes("<OFX")) {
    return;
  }
  throw new OfxInvalidFileError("missing_ofx_signature");
}

function splitStmtTrnBlocks(text: string): string[] {
  const upper = text.toUpperCase();
  const blocks: string[] = [];
  let searchFrom = 0;
  const openTag = "<STMTTRN>";
  const openLen = openTag.length;
  while (true) {
    const idx = upper.indexOf(openTag, searchFrom);
    if (idx === -1) break;
    const contentStart = idx + openLen;
    const nextOpen = upper.indexOf(openTag, contentStart);
    const nextCloseBank = upper.indexOf("</BANKTRANLIST>", contentStart);
    let end = text.length;
    if (nextOpen !== -1) end = Math.min(end, nextOpen);
    if (nextCloseBank !== -1) end = Math.min(end, nextCloseBank);
    blocks.push(text.slice(contentStart, end));
    searchFrom = nextOpen === -1 ? text.length : nextOpen;
  }
  return blocks;
}

function normalizeTrnamt(raw: string): string {
  const t = raw.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) {
    throw new OfxInvalidFileError("invalid_trnamt");
  }
  return t;
}

/**
 * Extrai transações OFX (SGML ou XML mínimo) de bytes UTF-8.
 * Sem I/O de rede nem Prisma.
 */
export function parseOfxTransactionsFromText(text: string): OfxNormalizedTransaction[] {
  validateOfxEnvelope(text);
  const blocks = splitStmtTrnBlocks(text);
  const out: OfxNormalizedTransaction[] = [];
  for (const block of blocks) {
    const trnamtRaw = readTagBlock(block, "TRNAMT");
    const dtpostedRaw = readTagBlock(block, "DTPOSTED");
    if (!trnamtRaw || !dtpostedRaw) {
      continue;
    }
    const trnamt = normalizeTrnamt(trnamtRaw);
    const dtposted = normalizeDtpostedRaw(dtpostedRaw);
    const bookedAt = parseBookedAtUtc(dtpostedRaw);
    const fitid = readTagBlock(block, "FITID");
    const memo = readTagBlock(block, "MEMO");
    const name = readTagBlock(block, "NAME");
    out.push({
      trnamt,
      dtposted,
      fitid: fitid || undefined,
      memo: memo || undefined,
      name: name || undefined,
      bookedAt,
    });
  }
  return out;
}

export function parseOfxTransactionsFromBytes(buf: Uint8Array): OfxNormalizedTransaction[] {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  return parseOfxTransactionsFromText(text);
}
