import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";

const unsafeChars = /[^a-zA-Z0-9._-]+/g;

export function sanitizeFilename(name: string): string {
  const normalized = name.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const base = segments[segments.length - 1] ?? name;
  const cleaned = base.replace(unsafeChars, "_").replace(/^\.+/, "").replace(/_+/g, "_");
  const trimmed = cleaned.slice(0, 200);
  return trimmed.length > 0 ? trimmed : "file";
}

/**
 * ADR-0004: `{organization_id}/_system/{uuid}-{filename_sanitized}` (workspace opcional no M1).
 */
export function buildObjectKey(
  organizationId: string,
  filename: string,
  objectUuid: string = randomUUID(),
): string {
  const safe = sanitizeFilename(filename);
  return `${organizationId}/_system/${objectUuid}-${safe}`;
}

/** ADR-0004 / plan M3 #6: chave de objeto por importação. */
export function buildImportObjectKey(
  organizationId: string,
  workspaceId: string,
  batchId: string,
  filename: string,
  objectUuid: string = randomUUID(),
): string {
  const safe = sanitizeFilename(filename);
  return `${organizationId}/workspaces/${workspaceId}/imports/${batchId}/${objectUuid}-${safe}`;
}

export async function putImportObject(
  key: string,
  body: Buffer,
  contentType?: string,
): Promise<{ ok: true } | { ok: false; skipped: true }> {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  if (!client || !bucket) {
    return { ok: false, skipped: true };
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType ?? "application/octet-stream",
    }),
  );
  return { ok: true };
}

export function getS3Client(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function pingObjectStorage(): Promise<{
  ok: boolean;
  mode: "skipped" | "checked";
  detail?: string;
}> {
  const bucket = process.env.S3_BUCKET;
  const client = getS3Client();
  if (!client || !bucket) {
    return { ok: true, mode: "skipped", detail: "S3 não configurado (CI/dev sem credenciais)." };
  }
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { ok: true, mode: "checked", detail: `Bucket ${bucket} acessível.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, mode: "checked", detail: msg };
  }
}

export function fingerprintConfig(): string {
  const bucket = process.env.S3_BUCKET ?? "";
  const region = process.env.S3_REGION ?? "";
  return createHash("sha256").update(`${bucket}|${region}`).digest("hex").slice(0, 12);
}
