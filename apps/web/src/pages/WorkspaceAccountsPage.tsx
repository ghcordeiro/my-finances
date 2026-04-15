import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  type AccountDto,
  type WorkspaceDto,
  createAccount,
  listAccounts,
  listWorkspaces,
  patchAccount,
} from "../api.js";

export function WorkspaceAccountsPage() {
  const { workspaceId = "" } = useParams();
  const [ws, setWs] = useState<WorkspaceDto | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"checking" | "investment">("checking");
  const [currency, setCurrency] = useState("BRL");
  const [initialBalance, setInitialBalance] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setError(null);
    try {
      const [{ workspaces }, acc] = await Promise.all([listWorkspaces(), listAccounts(workspaceId)]);
      setWs(workspaces.find((w) => w.id === workspaceId) ?? null);
      setAccounts(acc.accounts);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError("Workspace não encontrado nesta organização.");
      } else {
        setError(e instanceof ApiError ? e.message : "Erro ao carregar contas.");
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Parameters<typeof createAccount>[1] = {
        name: name.trim(),
        type,
        currency: currency.trim() || "BRL",
      };
      if (initialBalance.trim() !== "") {
        body.initialBalance = initialBalance.trim();
      }
      await createAccount(workspaceId, body);
      setName("");
      setInitialBalance("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(accountId: string) {
    if (!window.confirm("Arquivar esta conta?")) return;
    setBusy(true);
    setError(null);
    try {
      await patchAccount(workspaceId, accountId, { archive: true });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha ao arquivar.");
    } finally {
      setBusy(false);
    }
  }

  const archivedWs = ws?.archivedAt != null;

  return (
    <main className="mf-page">
      <nav className="mf-breadcrumb" aria-label="Navegação">
        <Link to="/app/workspaces">Workspaces</Link>
        <span aria-hidden> / </span>
        <span>{ws?.name ?? workspaceId}</span>
      </nav>
      <h1>Contas do workspace</h1>
      {ws ? (
        <p className="mf-lead">
          {ws.name} · {ws.kind === "personal" ? "Pessoal" : "Empresa"}
          {archivedWs ? " · arquivado (só leitura)" : ""}
        </p>
      ) : null}
      {error ? (
        <p className="mf-alert" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p>A carregar…</p> : null}
      {!loading && !archivedWs ? (
        <section className="mf-panel" aria-label="Nova conta">
          <h2 className="mf-panel-title">Nova conta</h2>
          <form className="mf-form-stack" onSubmit={(ev) => void onCreate(ev)}>
            <div className="mf-field">
              <label htmlFor="acc-name">Nome</label>
              <input id="acc-name" value={name} onChange={(ev) => setName(ev.target.value)} required maxLength={120} disabled={busy} />
            </div>
            <div className="mf-field">
              <label htmlFor="acc-type">Tipo</label>
              <select id="acc-type" value={type} onChange={(ev) => setType(ev.target.value as "checking" | "investment")} disabled={busy}>
                <option value="checking">Conta corrente</option>
                <option value="investment">Investimento</option>
              </select>
            </div>
            <div className="mf-field">
              <label htmlFor="acc-ccy">Moeda</label>
              <input id="acc-ccy" value={currency} onChange={(ev) => setCurrency(ev.target.value.toUpperCase())} maxLength={8} disabled={busy} />
            </div>
            <div className="mf-field">
              <label htmlFor="acc-bal">Saldo inicial (opcional)</label>
              <input
                id="acc-bal"
                inputMode="decimal"
                value={initialBalance}
                onChange={(ev) => setInitialBalance(ev.target.value)}
                placeholder="0.00"
                disabled={busy}
              />
            </div>
            <button type="submit" className="mf-btn-secondary" disabled={busy || !name.trim()}>
              Criar conta
            </button>
          </form>
        </section>
      ) : null}
      <section className="mf-panel" aria-label="Lista de contas">
        <h2 className="mf-panel-title">Saldo atual (derivado)</h2>
        <div className="mf-table-wrap">
          <table className="mf-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Moeda</th>
                <th>Saldo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.type === "checking" ? "Corrente" : "Investimento"}</td>
                  <td>{a.currency}</td>
                  <td>{a.currentBalance}</td>
                  <td>
                    {!a.archivedAt && !archivedWs ? (
                      <button type="button" className="mf-link-btn" disabled={busy} onClick={() => void onArchive(a.id)}>
                        Arquivar
                      </button>
                    ) : (
                      <span className="mf-muted">{a.archivedAt ? "Arquivada" : "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mf-page-footer">
        <Link to={`/app/workspaces/${workspaceId}/transfers`}>Ir para transferências →</Link>
      </p>
    </main>
  );
}
