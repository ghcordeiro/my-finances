import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiUrl, listWorkspaces } from "../api.js";

export function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(apiUrl("/v1/me"), { credentials: "include" });
      if (!res.ok) {
        setError(`Sessão inválida (${res.status})`);
        return;
      }
      const body = (await res.json()) as { user: { email: string } };
      setEmail(body.user.email);
      try {
        const { workspaces } = await listWorkspaces();
        const active = workspaces.find((w) => !w.archivedAt);
        setWorkspaceId(active?.id ?? workspaces[0]?.id ?? null);
      } catch (e) {
        if (e instanceof ApiError) setError(e.message);
        else setError("Não foi possível carregar workspaces.");
      }
    })();
  }, []);

  return (
    <main className="mf-page">
      <h1>Início</h1>
      {error ? (
        <p className="mf-alert" role="alert">
          {error}
        </p>
      ) : (
        <p data-testid="shell-welcome">{email ? `Olá, ${email}` : "Carregando…"}</p>
      )}
      <section className="mf-card-grid" aria-label="Atalhos M1">
        <Link className="mf-card-link" to="/app/workspaces">
          <h2>Workspaces</h2>
          <p>Gerir espaços PF/PJ, criar e arquivar.</p>
        </Link>
        {workspaceId ? (
          <>
            <Link className="mf-card-link" to={`/app/workspaces/${workspaceId}/accounts`}>
              <h2>Contas</h2>
              <p>Contas do workspace principal (podes mudar na lista).</p>
            </Link>
            <Link className="mf-card-link" to={`/app/workspaces/${workspaceId}/transfers`}>
              <h2>Transferências</h2>
              <p>Movimentar entre contas (intra ou PF↔PJ).</p>
            </Link>
          </>
        ) : null}
        <Link className="mf-card-link" to="/app/organization">
          <h2>Organização</h2>
          <p>Contexto do tenant e plano.</p>
        </Link>
      </section>
    </main>
  );
}
