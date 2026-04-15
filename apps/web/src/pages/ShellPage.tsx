import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../api";

export function ShellPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(apiUrl("/v1/me"), {
        credentials: "include",
      });
      if (!res.ok) {
        setError(`Sessão inválida (${res.status})`);
        return;
      }
      const body = (await res.json()) as { user: { email: string } };
      setEmail(body.user.email);
    })();
  }, []);

  return (
    <div className="mf-shell">
      <header className="mf-shell-header">
        <span className="mf-shell-brand">My Finances</span>
        <span className="mf-workspace-pill" title="Seletor de workspace (M1)">
          Workspace
        </span>
      </header>
      <main className="mf-shell-main">
        <h1>Dashboard</h1>
        {error ? (
          <p className="mf-alert" role="alert">
            {error}
          </p>
        ) : (
          <p data-testid="shell-welcome">
            {email ? `Olá, ${email}` : "Carregando…"}
          </p>
        )}
        <section className="mf-shell-panel" aria-label="Resumo M1">
          <p>Área autenticada — workspaces, contas e transferências em desenvolvimento (M1), alinhadas ao layout Stitch de referência no repositório.</p>
        </section>
        <p className="mf-shell-actions">
          <Link to="/login">Sair (ir para login)</Link>
        </p>
      </main>
    </div>
  );
}
