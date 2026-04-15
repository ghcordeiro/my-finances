export function buildMultipartImportPayload(
  fields: Record<string, string>,
  file: { filename: string; data: Buffer; fieldname?: string },
): { headers: Record<string, string>; payload: Buffer } {
  const boundary = `----formdata-test-${Date.now()}`;
  const fn = file.fieldname ?? "file";
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`, "utf-8"),
    );
  }
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fn}"; filename="${file.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      "utf-8",
    ),
  );
  chunks.push(file.data);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"));
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat(chunks),
  };
}
