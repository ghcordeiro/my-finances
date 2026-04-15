import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl, pickFirstOrganization } from "../api";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(apiUrl("/v1/auth/register"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, organizationName }),
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
    <main style={{ maxWidth: 420, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Cadastro</h1>
      <form onSubmit={onSubmit} aria-label="Formulário de cadastro">
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="organizationName">Nome da organização</label>
          <input
            id="organizationName"
            name="organizationName"
            type="text"
            required
            value={organizationName}
            onChange={(ev) => setOrganizationName(ev.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4 }}
          />
        </div>
        {error ? (
          <p role="alert" style={{ color: "crimson" }}>
            {error}
          </p>
        ) : null}
        <button type="submit">Criar conta</button>
      </form>
      <p>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </main>
  );
}
