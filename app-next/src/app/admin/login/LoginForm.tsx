"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { traduireErreurAuth } from "@/lib/auth-errors";
import { logAuthEvent, AUTH_EVENTS } from "@/lib/auth-audit";

export function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
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
      await logAuthEvent(supabase, undefined, AUTH_EVENTS.LOGIN_FAILED);
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

    // MFA : si l'admin a un facteur TOTP vérifié, exiger le code avant de continuer.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factors?.totp?.filter((f) => f.status === "verified") ?? [];

    if (verifiedTotp.length > 0) {
      setMfaFactorId(verifiedTotp[0].id);
      setLoading(false);
      return;
    }

    await logAuthEvent(supabase, data.user.id, AUTH_EVENTS.LOGIN_SUCCESS);
    // Navigation dure pour que le serveur voie les cookies frais.
    window.location.href = target;
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setError(null);
    setLoading(true);

    const target = safeNextPath(searchParams.get("next"), "/admin");
    const supabase = createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (challengeError) {
      setError(traduireErreurAuth(challengeError.message));
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: totpCode.trim(),
    });

    if (verifyError) {
      setError("Code invalide. Réessaie.");
      setTotpCode("");
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    await logAuthEvent(supabase, userData.user?.id, AUTH_EVENTS.MFA_CHALLENGE_OK);
    window.location.href = target;
  }

  return (
    <form onSubmit={mfaFactorId ? handleMfaSubmit : handleSubmit}>
      {!mfaFactorId ? (
        <>
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
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="totp">Code d&apos;authentification (application mobile)</label>
            <input
              id="totp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Vérification…" : "Vérifier le code"}
          </button>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
