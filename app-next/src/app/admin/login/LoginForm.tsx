"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";

export function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Redirection uniquement vers un chemin interne (anti open-redirect).
    const target = safeNextPath(searchParams.get("next"), "/admin");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Identifiants invalides ou accès refusé.");
      setLoading(false);
      return;
    }

    // Vérifier le rôle admin immédiatement : un compte valide sans rôle
    // admin est rejeté et déconnecté.
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      await supabase.auth.signOut();
      setError("Identifiants invalides ou accès refusé.");
      setLoading(false);
      return;
    }

    // Navigation dure pour que le serveur voie les cookies frais.
    window.location.href = target;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button className="btn btn--primary" type="submit" disabled={loading} style={{ width: "100%" }}>
        {loading ? "Connexion…" : "Se connecter"}
      </button>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
