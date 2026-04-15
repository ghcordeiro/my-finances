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
    <main style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>Dashboard</h1>
      {error ? (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      ) : (
        <p data-testid="shell-welcome">
          {email ? `Olá, ${email}` : "Carregando…"}
        </p>
      )}
      <p>Área autenticada — funcionalidades financeiras em breve (M1).</p>
      <p>
        <Link to="/login">Sair (ir para login)</Link>
      </p>
    </main>
  );
}
