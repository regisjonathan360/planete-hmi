"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { traduireErreurAuth } from "@/lib/auth-errors";
import { logAuthEvent, AUTH_EVENTS } from "@/lib/auth-audit";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";

const inputStyle: React.CSSProperties = {
  background: "rgba(10,10,20,0.8)", border: "1px solid rgba(244,239,228,0.15)",
  color: "#f4efe4", padding: "0.6rem 0.8rem", borderRadius: "8px", fontSize: "0.9rem",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "1rem", width: "100%", padding: "0.7rem",
  background: "var(--flame-orange, #ff6a00)", color: "#160500", border: "none",
  borderRadius: "8px", fontSize: "0.9rem", fontWeight: 700,
};

function Feedback({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error && <p style={{ color: "#ff5c7c", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
      {success && <p style={{ color: "#3ddc84", fontSize: "0.85rem", marginTop: "0.5rem" }}>{success}</p>}
    </>
  );
}

function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);

    if (next.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (next !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Re-vérification de l'identité avant modification.
    const { data: userData } = await supabase.auth.getUser();
    const { error: checkError } = await supabase.auth.signInWithPassword({
      email: userData.user?.email ?? "",
      password: current,
    });
    if (checkError) {
      setError("Mot de passe actuel incorrect.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setError(traduireErreurAuth(error.message));
      setLoading(false);
      return;
    }

    await logAuthEvent(supabase, userData.user?.id, AUTH_EVENTS.PASSWORD_UPDATED);
    setSuccess("Mot de passe mis à jour.");
    setCurrent(""); setNext(""); setConfirm("");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "2.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: "1rem" }}>Changer de mot de passe</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="password" required placeholder="Mot de passe actuel" value={current}
          autoComplete="current-password"
          onChange={(e) => setCurrent(e.target.value)} style={inputStyle}
        />
        <div>
          <input
            type="password" required placeholder="Nouveau mot de passe (8 caractères min.)"
            minLength={8} value={next} autoComplete="new-password"
            onChange={(e) => setNext(e.target.value)} style={inputStyle}
          />
          <PasswordStrengthMeter password={next} />
        </div>
        <input
          type="password" required placeholder="Confirmer le nouveau mot de passe"
          minLength={8} value={confirm} autoComplete="new-password"
          onChange={(e) => setConfirm(e.target.value)} style={inputStyle}
        />
      </div>
      <Feedback error={error} success={success} />
      <button type="submit" style={buttonStyle} disabled={loading}>
        {loading ? "..." : "Mettre à jour le mot de passe"}
      </button>
    </form>
  );
}

function ChangeEmailSection({ currentEmail }: { currentEmail: string }) {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    setLoading(true);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const { error: checkError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password,
    });
    if (checkError) {
      setError("Mot de passe actuel incorrect.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      setError(traduireErreurAuth(error.message));
      setLoading(false);
      return;
    }

    await logAuthEvent(supabase, userData.user?.id, AUTH_EVENTS.EMAIL_CHANGE_REQUESTED);
    setSuccess(
      `Un email de confirmation a été envoyé à ${email}. La nouvelle adresse sera active après validation.`
    );
    setPassword(""); setEmail("");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: "2.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", marginBottom: "1rem" }}>Changer d&apos;adresse email</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="email" required placeholder="Nouvelle adresse email" value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)} style={inputStyle}
        />
        <input
          type="password" required placeholder="Mot de passe actuel" value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)} style={inputStyle}
        />
      </div>
      <Feedback error={error} success={success} />
      <button type="submit" style={buttonStyle} disabled={loading}>
        {loading ? "..." : "Demander le changement d'email"}
      </button>
    </form>
  );
}

export function SecurityForms({ currentEmail }: { currentEmail: string }) {
  return (
    <>
      <ChangePasswordSection />
      <ChangeEmailSection currentEmail={currentEmail} />
    </>
  );
}
