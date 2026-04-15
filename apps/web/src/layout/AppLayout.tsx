import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearStoredOrganizationId, fetchOrgs, getStoredOrganizationId, apiUrl } from "../api.js";

export function AppLayout() {
  const navigate = useNavigate();
  const [orgLabel, setOrgLabel] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    const orgId = getStoredOrganizationId();
    if (!orgId) {
      navigate("/login", { replace: true });
      return;
    }
    void (async () => {
      const me = await fetch(apiUrl("/v1/me"), { credentials: "include" });
      if (!me.ok) {
        setSessionError(`Sessão inválida (${me.status})`);
        return;
      }
      try {
        const { organizations } = await fetchOrgs();
        const o = organizations.find((x) => x.id === orgId);
        setOrgLabel(o?.name ?? orgId.slice(0, 8));
      } catch {
        setOrgLabel(orgId.slice(0, 8));
      }
    })();
  }, [navigate]);

  async function logout() {
    await fetch(apiUrl("/v1/auth/logout"), { method: "POST", credentials: "include" }).catch(() => {});
    clearStoredOrganizationId();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mf-app-shell">
      <aside className="mf-sidebar" aria-label="Navegação principal">
        <div className="mf-sidebar-brand">
          <span className="mf-sidebar-logo" aria-hidden>
            ◆
          </span>
          <div>
            <div className="mf-sidebar-title">My Finances</div>
            {orgLabel ? <div className="mf-sidebar-sub">{orgLabel}</div> : null}
          </div>
        </div>
        <nav className="mf-sidebar-nav">
          <NavLink end className={navClass} to="/app">
            Início
          </NavLink>
          <NavLink className={navClass} to="/app/workspaces">
            Workspaces
          </NavLink>
          <NavLink className={navClass} to="/app/organization">
            Organização
          </NavLink>
        </nav>
        <div className="mf-sidebar-footer">
          <button type="button" className="mf-btn-ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </aside>
      <div className="mf-app-stage">
        {sessionError ? (
          <p className="mf-alert mf-alert--stage" role="alert">
            {sessionError}
          </p>
        ) : null}
        <Outlet />
      </div>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "mf-nav-link mf-nav-link--active" : "mf-nav-link";
}
