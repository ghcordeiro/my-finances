# ADR-0004: Armazenamento de objetos (anexos e uploads)

## Status

Aceito — 2026-04-15

## Contexto

RF-ATT-01 e RF-IMP-01 exigem arquivos isolados por tenant. No M0 precisamos apenas decidir o padrão de chaves e compatibilidade dev/prod.

## Decisão

- API compatível com **S3** (AWS S3, Cloudflare R2, MinIO, etc.).
- **Convenção de chave:** `{organization_id}/{workspace_id opcional}/{uuid}-{filename_sanitized}` — `workspace_id` entra quando M1 existir; no M0 uploads experimentais usam `{organization_id}/_system/{uuid}`.
- URLs assinadas (presigned GET/PUT) para upload/download direto do cliente quando possível; servidor valida membership antes de emitir URL.
- **Desenvolvimento:** MinIO ou LocalStack S3; **produção:** um bucket (ou prefixo forte) com política IAM restrita ao papel da aplicação.

## Consequências

**Positivas:** desacopla armazenamento de disco local; escala horizontal.

**Negativas:** consistência eventual; necessidade de antivírus/scan em fase futura para uploads públicos (fora M0).
