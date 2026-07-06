/**
 * Client Supabase administrateur (service role) — SERVEUR UNIQUEMENT.
 *
 * ⚠️ La clé secrète contourne les politiques RLS. Elle ne doit JAMAIS
 * être importée dans du code exécuté côté navigateur, ni exposée via
 * une variable NEXT_PUBLIC_*. Réservée aux Route Handlers / actions
 * serveur / Edge Functions de confiance.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "Configuration Supabase admin manquante (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)."
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
