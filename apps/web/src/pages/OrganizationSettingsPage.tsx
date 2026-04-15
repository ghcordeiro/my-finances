import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrgs, getStoredOrganizationId } from "../api.js";

export function OrganizationSettingsPage() {
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = getStoredOrganizationId();
    setOrgId(id);
    if (!id) return;
    void (async () => {
      try {
        const { organizations } = await fetchOrgs();
        const o = organizations.find((x) => x.id === id);
        if (o) {
          setName(o.name);
          setRole(o.role);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível carregar a organização.");
      }
    })();
  }, []);

  return (
    <main className="mf-page">
      <h1>Organização</h1>
      <p className="mf-lead">Contexto do tenant (M0/M1). Faturação Stripe e limites de plano são tratados na API.</p>
      {error ? (
        <p className="mf-alert" role="alert">
          {error}
        </p>
      ) : null}
      <section className="mf-panel">
        <h2 className="mf-panel-title">Organização ativa</h2>
        <dl className="mf-dl">
          <div>
            <dt>Nome</dt>
            <dd>{name ?? "—"}</dd>
          </div>
          <div>
            <dt>O teu papel</dt>
            <dd>{role ?? "—"}</dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd className="mf-mono">{orgId ?? "—"}</dd>
          </div>
        </dl>
        <p className="mf-muted mf-panel-note">
          O cabeçalho <code className="mf-code">X-Organization-Id</code> é enviado automaticamente em todas as chamadas M1
          (ver ADR-0006/0008).
        </p>
      </section>
      <section className="mf-panel">
        <h2 className="mf-panel-title">Workspaces e dados</h2>
        <p>Gere espaços PF/PJ e contas a partir da área de workspaces.</p>
        <Link className="mf-btn-secondary mf-btn-inline" to="/app/workspaces">
          Abrir workspaces
        </Link>
      </section>
    </main>
  );
}
