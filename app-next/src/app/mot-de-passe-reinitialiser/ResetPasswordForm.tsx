"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traduireErreurAuth } from "@/lib/auth-errors";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(traduireErreurAuth(error.message));
      setLoading(false);
      return;
    }

    // Le mot de passe étant changé, on repasse par la connexion.
    window.location.href = "/connexion?notice=password-updated";
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(10,10,20,0.8)", border: "1px solid rgba(244,239,228,0.15)",
    color: "#f4efe4", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "0.9rem",
    width: "100%",
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div>
          <input
            type="password" required placeholder="Nouveau mot de passe (8 caractères min.)"
            minLength={8} value={password} autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)} style={inputStyle}
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <input
          type="password" required placeholder="Confirmer le mot de passe"
          minLength={8} value={confirm} autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)} style={inputStyle}
        />
      </div>

      {error && <p style={{ color: "#ff5c7c", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}

      <button
        type="submit" disabled={loading}
        style={{
          marginTop: "1rem", width: "100%", padding: "0.7rem",
          background: "var(--flame-orange, #ff6a00)", color: "#160500", border: "none",
          borderRadius: "8px", fontSize: "0.9rem", fontWeight: 700, cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "..." : "Enregistrer"}
      </button>
    </form>
  );
}
