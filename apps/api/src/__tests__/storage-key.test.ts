import { describe, expect, it } from "vitest";
import { buildObjectKey, sanitizeFilename } from "../services/storage.js";

describe("T-TEST-010 chave S3", () => {
  it("prefixa organizationId e sanitiza nome", () => {
    const org = "11111111-1111-4111-8111-111111111111";
    const key = buildObjectKey(org, "meu arquivo (1).pdf", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(key.startsWith(`${org}/_system/`)).toBe(true);
    expect(key).toContain("meu_arquivo_1_.pdf");
  });

  it("sanitizeFilename trata caracteres especiais", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("!!!")).toMatch(/^_+$/);
  });
});
