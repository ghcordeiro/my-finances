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

export function clearStoredOrganizationId() {
  window.localStorage.removeItem(ORG_KEY);
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

function requireOrgId(): string {
  const id = getStoredOrganizationId();
  if (!id) throw new Error("no_organization");
  return id;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

/** Fetch autenticado com contexto de organização (ADR-0006 / M1). */
export async function apiOrgFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const orgId = requireOrgId();
  const headers = new Headers(init.headers);
  headers.set(ORG_HEADER, orgId);
  if (init.body != null && init.body !== "" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(apiUrl(path), { ...init, credentials: "include", headers });
}

export async function apiOrgJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiOrgFetch(path, init);
  const body = await readJson(res);
  if (!res.ok) {
    const o = body as { error?: string; message?: string; details?: unknown };
    throw new ApiError(
      res.status,
      o.message ?? o.error ?? res.statusText,
      o.error,
      o.details,
    );
  }
  return body as T;
}

// —— Tipos M1 (espelham respostas JSON da API) ——

export type WorkspaceDto = {
  id: string;
  organizationId: string;
  kind: "personal" | "business";
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountDto = {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  type: "checking" | "investment";
  currency: string;
  initialBalance: string;
  currentBalance: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransferDto = {
  id: string;
  organizationId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: string;
  bookedAt: string;
  memo: string | null;
  createdAt: string;
};

export async function listWorkspaces() {
  return apiOrgJson<{ workspaces: WorkspaceDto[] }>("/v1/workspaces");
}

export async function createWorkspace(body: { name: string; kind: "personal" | "business" }) {
  return apiOrgJson<{ workspace: WorkspaceDto }>("/v1/workspaces", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchWorkspace(workspaceId: string, body: { name?: string; archive?: boolean }) {
  return apiOrgJson<{ workspace: WorkspaceDto }>(`/v1/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function listAccounts(workspaceId: string) {
  return apiOrgJson<{ accounts: AccountDto[] }>(`/v1/workspaces/${workspaceId}/accounts`);
}

export async function createAccount(
  workspaceId: string,
  body: {
    name: string;
    type: "checking" | "investment";
    currency?: string;
    initialBalance?: number | string;
  },
) {
  return apiOrgJson<{ account: AccountDto }>(`/v1/workspaces/${workspaceId}/accounts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchAccount(
  workspaceId: string,
  accountId: string,
  body: { name?: string; archive?: boolean },
) {
  return apiOrgJson<{ account: AccountDto }>(`/v1/workspaces/${workspaceId}/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function listTransfers(workspaceId: string) {
  return apiOrgJson<{ transfers: TransferDto[] }>(`/v1/workspaces/${workspaceId}/transfers`);
}

export async function createTransfer(body: {
  fromAccountId: string;
  toAccountId: string;
  amount: number | string;
  currency: string;
  bookedAt: string;
  memo?: string;
}) {
  return apiOrgJson<{ transfer: TransferDto }>("/v1/transfers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
