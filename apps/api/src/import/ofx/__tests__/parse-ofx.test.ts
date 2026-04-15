import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OfxInvalidFileError,
  parseOfxTransactionsFromBytes,
  parseOfxTransactionsFromText,
} from "../parse-ofx.js";

function loadSampleOfxFixture(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "..", "..", "..", "__tests__", "fixtures", "sample.ofx"), "utf-8");
}

describe("M3-T-002 parser OFX", () => {
  it("extrai STMTTRN da fixture com tags SGML e casing misto", () => {
    const text = loadSampleOfxFixture();
    const rows = parseOfxTransactionsFromText(text);
    expect(rows).toHaveLength(2);

    const first = rows[0];
    const second = rows[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).toMatchObject({
      trnamt: "-10.50",
      dtposted: "20240115120000",
      fitid: "fixture-fit-001",
      memo: "Café fictício",
      name: "Loja Anon A",
    });
    expect(first.bookedAt.toISOString()).toBe("2024-01-15T15:00:00.000Z");

    expect(second).toMatchObject({
      trnamt: "100.00",
      dtposted: "20240120",
      fitid: "fixture-fit-002",
      memo: "mixed case tags",
    });
    expect(second.name).toBeUndefined();
    expect(second.bookedAt.toISOString()).toBe("2024-01-20T03:00:00.000Z");
  });

  it("aceita buffer UTF-8", () => {
    const text = loadSampleOfxFixture();
    const rows = parseOfxTransactionsFromBytes(new TextEncoder().encode(text));
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("rejeita ficheiro sem assinatura OFX", () => {
    expect(() => parseOfxTransactionsFromText("not an ofx")).toThrow(OfxInvalidFileError);
  });
});
