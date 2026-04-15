/**
 * Em dev, sem VITE_API_URL, usa URLs relativas (/) para o proxy do Vite —
 * assim o cookie de sessão fica na mesma origem da SPA (evita 401 após register
 * quando a página é localhost e a API é 127.0.0.1).
 */
function apiBase(): string {
  const v = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
  return v ? v : "";
}

const base = apiBase();

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}

export const ORG_HEADER = "X-Organization-Id";

const ORG_KEY = "mf.activeOrganizationId";

export function getStoredOrganizationId(): string | null {
  return window.localStorage.getItem(ORG_KEY);
}

export function setStoredOrganizationId(id: string) {
  window.localStorage.setItem(ORG_KEY, id);
}

export async function fetchOrgs(cookieMode: RequestCredentials = "include") {
  const res = await fetch(apiUrl("/v1/organizations"), { credentials: cookieMode });
  if (!res.ok) throw new Error(`orgs_${res.status}`);
  return (await res.json()) as {
    organizations: { id: string; name: string; role: string }[];
  };
}

export async function pickFirstOrganization() {
  const data = await fetchOrgs();
  const first = data.organizations[0];
  if (!first) throw new Error("no_organization");
  setStoredOrganizationId(first.id);
  return first.id;
}
