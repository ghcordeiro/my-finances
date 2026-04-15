import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  type WorkspaceDto,
  createWorkspace,
  listWorkspaces,
  patchWorkspace,
} from "../api.js";

export function WorkspacesPage() {
  const [rows, setRows] = useState<WorkspaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"personal" | "business">("business");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { workspaces } = await listWorkspaces();
      setRows(workspaces);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao listar workspaces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createWorkspace({ name: name.trim(), kind });
      setName("");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
      } else {
        setError(e instanceof ApiError ? e.message : "Não foi possível criar o workspace.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(id: string) {
    if (!window.confirm("Arquivar este workspace? Novas contas e transferências deixam de ser permitidas.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchWorkspace(id, { archive: true });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha ao arquivar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mf-page">
      <h1>Workspaces</h1>
      <p className="mf-lead">Espaços PF (Pessoal) e PJ (Empresa) dentro da tua organização.</p>
      {error ? (
        <p className="mf-alert" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p>A carregar…</p> : null}
      <section className="mf-panel" aria-label="Novo workspace">
        <h2 className="mf-panel-title">Criar workspace</h2>
        <form className="mf-form-row" onSubmit={(ev) => void onCreate(ev)}>
          <div className="mf-field mf-field--inline">
            <label htmlFor="ws-name">Nome</label>
            <input
              id="ws-name"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              required
              minLength={1}
              maxLength={120}
              disabled={busy}
            />
          </div>
          <div className="mf-field mf-field--inline">
            <label htmlFor="ws-kind">Tipo</label>
            <select id="ws-kind" value={kind} onChange={(ev) => setKind(ev.target.value as "personal" | "business")} disabled={busy}>
              <option value="personal">Pessoal (PF)</option>
              <option value="business">Empresa (PJ)</option>
            </select>
          </div>
          <button type="submit" className="mf-btn-secondary" disabled={busy || !name.trim()}>
            Adicionar
          </button>
        </form>
      </section>
      <section className="mf-panel" aria-label="Lista de workspaces">
        <h2 className="mf-panel-title">Os teus workspaces</h2>
        <div className="mf-table-wrap">
          <table className="mf-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.kind === "personal" ? "Pessoal" : "Empresa"}</td>
                  <td>{w.archivedAt ? "Arquivado" : "Ativo"}</td>
                  <td className="mf-table-actions">
                    {!w.archivedAt ? (
                      <>
                        <Link className="mf-inline-link" to={`/app/workspaces/${w.id}/accounts`}>
                          Contas
                        </Link>
                        <span aria-hidden> · </span>
                        <Link className="mf-inline-link" to={`/app/workspaces/${w.id}/transfers`}>
                          Transferências
                        </Link>
                        {w.kind !== "personal" ? (
                          <>
                            <span aria-hidden> · </span>
                            <button type="button" className="mf-link-btn" disabled={busy} onClick={() => void onArchive(w.id)}>
                              Arquivar
                            </button>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="mf-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
