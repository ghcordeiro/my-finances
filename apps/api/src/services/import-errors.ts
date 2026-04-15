import type { FastifyReply } from "fastify";

export type ImportErrorCode =
  | "duplicate_import"
  | "invalid_file"
  | "invalid_multipart"
  | "account_not_found"
  | "template_not_found"
  | "template_name_conflict"
  | "csv_template_required"
  | "import_too_many_lines"
  | "file_too_large"
  | "workspace_not_found"
  | "forbidden";

export async function sendImportError(
  reply: FastifyReply,
  status: number,
  error: ImportErrorCode,
  message?: string,
): Promise<void> {
  await reply.status(status).send({
    error,
    ...(message ? { message } : {}),
  });
}
