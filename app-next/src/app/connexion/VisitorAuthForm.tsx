"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function VisitorAuthForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      window.location.href = nextPath;
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${nextPath}` },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setSuccess("Un email de confirmation a été envoyé. Vérifie ta boîte.");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(10,10,20,0.8)", border: "1px solid rgba(244,239,228,0.15)",
    color: "#f4efe4", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "0.9rem",
    width: "100%",
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} style={inputStyle}
        />
        <input
          type="password" required placeholder="Mot de passe" minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)} style={inputStyle}
        />
      </div>

      {error && <p style={{ color: "#ff5c7c", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
      {success && <p style={{ color: "#3ddc84", fontSize: "0.85rem", marginTop: "0.5rem" }}>{success}</p>}

      <button
        type="submit" disabled={loading}
        style={{
          marginTop: "1rem", width: "100%", padding: "0.7rem",
          background: "var(--flame-orange, #ff6a00)", color: "#160500", border: "none",
          borderRadius: "8px", fontSize: "0.9rem", fontWeight: 700, cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
      </button>

      <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem", color: "rgba(244,239,228,0.6)" }}>
        {mode === "login" ? (
          <>Pas encore de compte ? <button type="button" onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: "var(--flame-orange, #ff6a00)", cursor: "pointer", textDecoration: "underline" }}>Inscription</button></>
        ) : (
          <>Déjà un compte ? <button type="button" onClick={() => setMode("login")} style={{ background: "none", border: "none", color: "var(--flame-orange, #ff6a00)", cursor: "pointer", textDecoration: "underline" }}>Connexion</button></>
        )}
      </p>
    </form>
  );
}
