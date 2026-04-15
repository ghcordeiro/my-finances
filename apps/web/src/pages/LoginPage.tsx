import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl, pickFirstOrganization } from "../api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(apiUrl("/v1/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? `Erro ${res.status}`);
      return;
    }
    await pickFirstOrganization();
    navigate("/app", { replace: true });
  }

  return (
    <main className="mf-auth-page">
      <div className="mf-auth-card">
        <h1>Entrar</h1>
        <form onSubmit={onSubmit} aria-label="Formulário de login">
          <div className="mf-field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </div>
          <div className="mf-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </div>
          {error ? (
            <p className="mf-alert" role="alert">
              {error}
            </p>
          ) : null}
          <button className="mf-btn-primary" type="submit">
            Entrar
          </button>
        </form>
        <p className="mf-auth-footer">
          Novo por aqui? <Link to="/register">Criar conta</Link>
        </p>
      </div>
    </main>
  );
}
