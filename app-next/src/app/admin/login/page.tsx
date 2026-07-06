"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 380 }}><h1>Connexion admin</h1></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const denied = params.get("denied");
  const redirectTo = params.get("redirect") || "/admin/charts";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setChargement(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 380 }}>
      <h1>Connexion admin</h1>
      {denied && (
        <p className="admin__err">Accès refusé : ce compte n’a pas le rôle administrateur.</p>
      )}
      <form onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        <label htmlFor="pw">Mot de passe</label>
        <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {erreur && <p className="admin__err">{erreur}</p>}
        <p style={{ marginTop: "1rem" }}>
          <button className="admin__btn" type="submit" disabled={chargement}>
            {chargement ? "Connexion…" : "Se connecter"}
          </button>
        </p>
      </form>
    </div>
  );
}
