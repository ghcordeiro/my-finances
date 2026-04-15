export function extractSessionCookie(setCookie: string | string[] | undefined): string | null {
  if (!setCookie) return null;
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const line of parts) {
    const m = /^mf_session=([^;]+)/.exec(line);
    if (m?.[1]) return `mf_session=${m[1]}`;
  }
  return null;
}
