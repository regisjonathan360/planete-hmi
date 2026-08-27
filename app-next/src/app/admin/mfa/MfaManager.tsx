"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traduireErreurAuth } from "@/lib/auth-errors";
import { logAuthEvent, AUTH_EVENTS } from "@/lib/auth-audit";

type Factor = { id: string; friendly_name?: string | null; status: string };

export function MfaManager() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Incrémenté pour recharger la liste des facteurs après une mutation.
  const [reloadKey, setReloadKey] = useState(0);

  // État d'enrôlement en cours.
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    let active = true;
    createClient().auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setError(traduireErreurAuth(error.message));
        return;
      }
      setFactors((data?.totp ?? []) as Factor[]);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function startEnroll() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Planète HMI Admin",
    });
    if (error || !data?.totp) {
      setError(traduireErreurAuth(error?.message ?? "Enrôlement impossible."));
      setLoading(false);
      return;
    }
    setEnrollFactorId(data.id);
    setQrCode(data.totp.qr_code ?? null);
    setSecret(data.totp.secret ?? null);
    setLoading(false);
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollFactorId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: challenge, error: chError } = await supabase.auth.mfa.challenge({
      factorId: enrollFactorId,
    });
    if (chError) {
      setError(traduireErreurAuth(chError.message));
      setLoading(false);
      return;
    }

    const { error: vError } = await supabase.auth.mfa.verify({
      factorId: enrollFactorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (vError) {
      setError("Code invalide. Réessaie.");
      setCode("");
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    await logAuthEvent(supabase, userData.user?.id, AUTH_EVENTS.MFA_ENROLLED);

    // Réinitialiser l'état d'enrôlement et recharger la liste.
    setEnrollFactorId(null); setQrCode(null); setSecret(null); setCode("");
    setReloadKey((k) => k + 1);
    setLoading(false);
  }

  async function unenroll(factorId: string) {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setError(traduireErreurAuth(error.message));
    } else {
      const { data: userData } = await supabase.auth.getUser();
      await logAuthEvent(supabase, userData.user?.id, AUTH_EVENTS.MFA_UNENROLLED);
    }
    setReloadKey((k) => k + 1);
    setLoading(false);
  }

  const verified = factors?.filter((f) => f.status === "verified") ?? [];
  const inputStyle: React.CSSProperties = {
    background: "rgba(10,10,20,0.8)", border: "1px solid rgba(244,239,228,0.15)",
    color: "#f4efe4", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "1rem",
    width: "100%", textAlign: "center", letterSpacing: "0.3em",
  };

  return (
    <div>
      {error && <p style={{ color: "#ff5c7c", fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</p>}

      {/* Étape enrôlement : QR + vérification */}
      {qrCode && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
            1. Scanne ce QR code avec ton application d&apos;authentification.
          </p>
          {qrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrCode} alt="QR code TOTP" width={180} height={180} style={{ display: "block", margin: "0 auto 1rem", borderRadius: 8 }} />
          )}
          {secret && (
            <p style={{ fontSize: "0.78rem", color: "rgba(244,239,228,0.6)", textAlign: "center", marginBottom: "1rem", wordBreak: "break-all" }}>
              Saisie manuelle : <strong>{secret}</strong>
            </p>
          )}
          <form onSubmit={verifyEnroll}>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              2. Saisis le code à 6 chiffres généré.
            </p>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
              placeholder="123456" value={code} required autoFocus
              onChange={(e) => setCode(e.target.value)} style={inputStyle}
              autoComplete="one-time-code"
            />
            <button className="btn btn--primary" type="submit" disabled={loading} style={{ width: "100%", marginTop: "0.75rem" }}>
              {loading ? "Vérification…" : "Activer la double authentification"}
            </button>
          </form>
        </div>
      )}

      {/* Facteurs actifs */}
      {!qrCode && factors !== null && (
        <>
          {verified.length === 0 ? (
            <p style={{ color: "#ffb347", fontSize: "0.9rem", marginBottom: "1rem" }}>
              ⚠️ Aucune double authentification active. Recommandé pour un compte administrateur.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem" }}>
              {verified.map((f) => (
                <li key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.75rem", border: "1px solid rgba(244,239,228,0.12)", borderRadius: "8px", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem" }}>
                    ✅ {f.friendly_name || "Application d'authentification"}
                  </span>
                  <button
                    type="button"
                    onClick={() => unenroll(f.id)}
                    disabled={loading}
                    style={{
                      background: "transparent", border: "1px solid rgba(255,92,124,0.4)",
                      color: "#ff5c7c", padding: "0.35rem 0.7rem", borderRadius: "6px",
                      cursor: "pointer", fontSize: "0.8rem",
                    }}
                  >
                    Désactiver
                  </button>
                </li>
              ))}
            </ul>
          )}

          {verified.length === 0 && (
            <button className="btn btn--primary" type="button" onClick={startEnroll} disabled={loading}>
              {loading ? "..." : "Activer la double authentification"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
