"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { traduireErreurAuth } from "@/lib/auth-errors";
import { logAuthEvent, AUTH_EVENTS } from "@/lib/auth-audit";
import { Turnstile } from "@/components/Turnstile";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

type Mode = "login" | "signup" | "magic";

export function VisitorAuthForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Redirection uniquement vers un chemin interne (anti open-redirect).
  const target = safeNextPath(nextPath, "/compte");
  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

  function resetFeedback() {
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);

    if (mode !== "magic" && password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        });
        if (error) {
          await logAuthEvent(supabase, undefined, AUTH_EVENTS.LOGIN_FAILED);
          setError(traduireErreurAuth(error.message)); setLoading(false); return;
        }
        await logAuthEvent(supabase, data.user?.id, AUTH_EVENTS.LOGIN_SUCCESS);
        window.location.href = target;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl(),
            ...(captchaToken ? { captchaToken } : {}),
          },
        });
        if (error) { setError(traduireErreurAuth(error.message)); setLoading(false); return; }
        await logAuthEvent(supabase, data.user?.id, AUTH_EVENTS.SIGNUP);
        setSuccess("Un email de confirmation a été envoyé. Vérifie ta boîte.");
        setLoading(false);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: callbackUrl(),
            shouldCreateUser: true,
            ...(captchaToken ? { captchaToken } : {}),
          },
        });
        if (error) { setError(traduireErreurAuth(error.message)); setLoading(false); return; }
        setSuccess("Lien de connexion envoyé ! Vérifie ta boîte mail.");
        setLoading(false);
      }
    } catch {
      setError("Une erreur réseau est survenue. Réessaie.");
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "facebook") {
    resetFeedback();
    setOauthLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setError(
        provider === "google"
          ? "Connexion Google indisponible pour le moment."
          : "Connexion Facebook indisponible pour le moment."
      );
      setOauthLoading(null);
    }
    // En cas de succès le navigateur est redirigé vers le fournisseur.
  }

  const inputStyle: React.CSSProperties = {
    background: "rgba(10,10,20,0.8)", border: "1px solid rgba(244,239,228,0.15)",
    color: "#f4efe4", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "0.9rem",
    width: "100%",
  };

  const oauthButtonStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    width: "100%", padding: "0.6rem", background: "rgba(244,239,228,0.06)",
    color: "#f4efe4", border: "1px solid rgba(244,239,228,0.15)",
    borderRadius: "8px", fontSize: "0.85rem", fontWeight: 600,
    cursor: oauthLoading ? "wait" : "pointer",
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" style={oauthButtonStyle} disabled={oauthLoading !== null} onClick={() => handleOAuth("google")}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {oauthLoading === "google" ? "Redirection…" : "Continuer avec Google"}
        </button>
        <button type="button" style={oauthButtonStyle} disabled={oauthLoading !== null} onClick={() => handleOAuth("facebook")}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z" />
          </svg>
          {oauthLoading === "facebook" ? "Redirection…" : "Continuer avec Facebook"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <span style={{ flex: 1, height: "1px", background: "rgba(244,239,228,0.12)" }} />
        <span style={{ fontSize: "0.75rem", color: "rgba(244,239,228,0.5)" }}>ou par email</span>
        <span style={{ flex: 1, height: "1px", background: "rgba(244,239,228,0.12)" }} />
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} style={inputStyle}
            autoComplete="email"
          />
          {mode !== "magic" && (
            <>
              <input
                type="password" required placeholder="Mot de passe" minLength={8} value={password}
                onChange={(e) => setPassword(e.target.value)} style={inputStyle}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "signup" && (
                <>
                  <p style={{ fontSize: "0.75rem", color: "rgba(244,239,228,0.5)", margin: 0 }}>
                    8 caractères minimum.
                  </p>
                  <PasswordStrengthMeter password={password} />
                </>
              )}
            </>
          )}
        </div>

        <Turnstile onToken={setCaptchaToken} />

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
          {loading
            ? "..."
            : mode === "login"
              ? "Se connecter"
              : mode === "signup"
                ? "Créer mon compte"
                : "Recevoir un lien magique"}
        </button>

        <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem", color: "rgba(244,239,228,0.6)" }}>
          {mode === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <button type="button" onClick={() => { setMode("signup"); resetFeedback(); }} style={{ background: "none", border: "none", color: "var(--flame-orange, #ff6a00)", cursor: "pointer", textDecoration: "underline" }}>Inscription</button>
              {" · "}
              <Link href="/mot-de-passe-oublie" style={{ color: "var(--flame-orange, #ff6a00)", textDecoration: "underline" }}>
                Mot de passe oublié ?
              </Link>
              {" · "}
              <button type="button" onClick={() => { setMode("magic"); resetFeedback(); }} style={{ background: "none", border: "none", color: "var(--flame-orange, #ff6a00)", cursor: "pointer", textDecoration: "underline" }}>Lien magique</button>
            </>
          ) : (
            <>Déjà un compte ?{" "}
              <button type="button" onClick={() => { setMode("login"); resetFeedback(); }} style={{ background: "none", border: "none", color: "var(--flame-orange, #ff6a00)", cursor: "pointer", textDecoration: "underline" }}>Connexion</button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
