"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  nextPath: string;
  initialMessage?: string;
}

export function AuthForm({ nextPath, initialMessage }: AuthFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();

    if (!email || password.length < 8 || (mode === "signup" && !displayName)) {
      setMessage("Vérifie les informations saisies.");
      setIsError(true);
      setBusy(false);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("Adresse e-mail ou mot de passe incorrect.");
        setIsError(true);
        setBusy(false);
        return;
      }

      router.push(nextPath, { scroll: true });
      router.refresh();
      return;
    }

    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { display_name: displayName },
      },
    });

    if (error) {
      setMessage("Ce compte ne peut pas être créé pour le moment.");
      setIsError(true);
      setBusy(false);
      return;
    }

    if (data.session) {
      router.push(nextPath, { scroll: true });
      router.refresh();
      return;
    }

    setMessage("Consulte ton e-mail pour confirmer la création du compte.");
    setBusy(false);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
  }

  return (
    <div className="artist-auth-panel">
      <div className="artist-segmented" aria-label="Type de connexion">
        <button
          type="button"
          className={mode === "login" ? "is-active" : ""}
          aria-pressed={mode === "login"}
          onClick={() => switchMode("login")}
        >
          Connexion
        </button>
        <button
          type="button"
          className={mode === "signup" ? "is-active" : ""}
          aria-pressed={mode === "signup"}
          onClick={() => switchMode("signup")}
        >
          Créer un compte
        </button>
      </div>

      <form className="artist-auth-form" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label>
            Nom d&apos;artiste
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              maxLength={120}
              required
            />
          </label>
        )}

        <label>
          Adresse e-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label>
          Mot de passe
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </label>

        <button className="btn btn-primary artist-submit" type="submit" disabled={busy}>
          {busy
            ? "Patiente..."
            : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
        </button>

        <p
          className={`artist-form-message${isError ? " is-error" : ""}`}
          aria-live="polite"
        >
          {message}
        </p>
      </form>
    </div>
  );
}
