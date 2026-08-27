"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traduireErreurAuth } from "@/lib/auth-errors";
import { Turnstile } from "@/components/Turnstile";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/mot-de-passe-reinitialiser")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
      ...(captchaToken ? { captchaToken } : {}),
    });

    if (error) {
      setError(traduireErreurAuth(error.message));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(10,10,20,0.8)", border: "1px solid rgba(244,239,228,0.15)",
    color: "#f4efe4", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "0.9rem",
    width: "100%",
  };

  if (sent) {
    return (
      <p style={{ color: "#3ddc84", fontSize: "0.9rem" }}>
        Si un compte existe avec cet email, un lien de réinitialisation vient d&apos;être envoyé.
        Pense à vérifier tes spams.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email" required placeholder="Email" value={email}
        onChange={(e) => setEmail(e.target.value)} style={inputStyle}
        autoComplete="email"
      />
      <Turnstile onToken={setCaptchaToken} />
      {error && <p style={{ color: "#ff5c7c", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
      <button
        type="submit" disabled={loading}
        style={{
          marginTop: "1rem", width: "100%", padding: "0.7rem",
          background: "var(--flame-orange, #ff6a00)", color: "#160500", border: "none",
          borderRadius: "8px", fontSize: "0.9rem", fontWeight: 700, cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "..." : "Envoyer le lien"}
      </button>
    </form>
  );
}
