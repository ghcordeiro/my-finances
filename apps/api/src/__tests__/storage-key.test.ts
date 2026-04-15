import { describe, expect, it } from "vitest";
import { buildImportObjectKey, buildObjectKey, sanitizeFilename } from "../services/storage.js";

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

  it("M3-T-006 buildImportObjectKey segue ADR-0004 / plan #6", () => {
    const org = "11111111-1111-4111-8111-111111111111";
    const ws = "22222222-2222-4222-8222-222222222222";
    const batch = "33333333-3333-4333-8333-333333333333";
    const key = buildImportObjectKey(org, ws, batch, "meu ficheiro (1).ofx", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(key).toBe(
      `${org}/workspaces/${ws}/imports/${batch}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-meu_ficheiro_1_.ofx`,
    );
  });
});
