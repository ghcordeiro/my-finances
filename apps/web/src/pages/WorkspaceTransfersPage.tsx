import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  type AccountDto,
  type TransferDto,
  type WorkspaceDto,
  createTransfer,
  listAccounts,
  listTransfers,
  listWorkspaces,
} from "../api.js";

type AccountOption = { workspace: WorkspaceDto; account: AccountDto };

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WorkspaceTransfersPage() {
  const { workspaceId = "" } = useParams();
  const [ws, setWs] = useState<WorkspaceDto | null>(null);
  const [transfers, setTransfers] = useState<TransferDto[]>([]);
  const [options, setOptions] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [bookedAt, setBookedAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setError(null);
    try {
      const { workspaces } = await listWorkspaces();
      const w = workspaces.find((x) => x.id === workspaceId) ?? null;
      setWs(w);
      const activeWs = workspaces.filter((x) => !x.archivedAt);
      const pairs = await Promise.all(
        activeWs.map(async (workspace) => {
          const { accounts } = await listAccounts(workspace.id);
          return accounts.filter((a) => !a.archivedAt).map((account) => ({ workspace, account }));
        }),
      );
      setOptions(pairs.flat());
      const t = await listTransfers(workspaceId);
      setTransfers(t.transfers);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError("Workspace não encontrado.");
      } else {
        setError(e instanceof ApiError ? e.message : "Erro ao carregar.");
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const accountLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const { workspace, account } of options) {
      m.set(account.id, `${workspace.name} — ${account.name} (${account.currency})`);
    }
    return m;
  }, [options]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const iso = new Date(bookedAt).toISOString();
      await createTransfer({
        fromAccountId: fromId,
        toAccountId: toId,
        amount: amount.trim(),
        currency: currency.trim() || "BRL",
        bookedAt: iso,
        memo: memo.trim() || undefined,
      });
      setAmount("");
      setMemo("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Transferência rejeitada.");
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
        <Link to={`/app/workspaces/${workspaceId}/accounts`}>{ws?.name ?? "Contas"}</Link>
        <span aria-hidden> / </span>
        <span>Transferências</span>
      </nav>
      <h1>Transferências</h1>
      <p className="mf-lead">Lista filtrada por este workspace; o formulário usa todas as contas ativas da organização.</p>
      {error ? (
        <p className="mf-alert" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p>A carregar…</p> : null}
      {!loading && archivedWs ? <p className="mf-muted">Workspace arquivado — só listagem.</p> : null}
      {!loading && !archivedWs ? (
        <section className="mf-panel" aria-label="Nova transferência">
          <h2 className="mf-panel-title">Nova transferência</h2>
          <form className="mf-form-stack" onSubmit={(ev) => void onSubmit(ev)}>
            <div className="mf-field">
              <label htmlFor="t-from">Conta origem</label>
              <select id="t-from" value={fromId} onChange={(ev) => setFromId(ev.target.value)} required disabled={busy}>
                <option value="">—</option>
                {options.map(({ account }) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel.get(account.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mf-field">
              <label htmlFor="t-to">Conta destino</label>
              <select id="t-to" value={toId} onChange={(ev) => setToId(ev.target.value)} required disabled={busy}>
                <option value="">—</option>
                {options.map(({ account }) => (
                  <option key={`to-${account.id}`} value={account.id}>
                    {accountLabel.get(account.id)}
                  </option>
                ))}
              </select>
            </div>
            <div className="mf-field">
              <label htmlFor="t-amt">Valor</label>
              <input id="t-amt" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} required disabled={busy} />
            </div>
            <div className="mf-field">
              <label htmlFor="t-ccy">Moeda</label>
              <input id="t-ccy" value={currency} onChange={(ev) => setCurrency(ev.target.value.toUpperCase())} maxLength={8} disabled={busy} />
            </div>
            <div className="mf-field">
              <label htmlFor="t-when">Data/hora contábil</label>
              <input
                id="t-when"
                type="datetime-local"
                value={bookedAt}
                onChange={(ev) => setBookedAt(ev.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="mf-field">
              <label htmlFor="t-memo">Nota (opcional)</label>
              <input id="t-memo" value={memo} onChange={(ev) => setMemo(ev.target.value)} maxLength={500} disabled={busy} />
            </div>
            <button type="submit" className="mf-btn-secondary" disabled={busy || !fromId || !toId}>
              Registar transferência
            </button>
          </form>
        </section>
      ) : null}
      <section className="mf-panel" aria-label="Histórico neste workspace">
        <h2 className="mf-panel-title">Movimentos visíveis aqui</h2>
        <div className="mf-table-wrap">
          <table className="mf-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>De</th>
                <th>Para</th>
                <th>Valor</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.bookedAt).toLocaleString()}</td>
                  <td className="mf-mono">{accountLabel.get(t.fromAccountId) ?? t.fromAccountId.slice(0, 8)}</td>
                  <td className="mf-mono">{accountLabel.get(t.toAccountId) ?? t.toAccountId.slice(0, 8)}</td>
                  <td>
                    {t.amount} {t.currency}
                  </td>
                  <td>{t.memo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
