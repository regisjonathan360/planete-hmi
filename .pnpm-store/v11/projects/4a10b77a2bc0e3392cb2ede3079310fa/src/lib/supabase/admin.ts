/**
 * Client Supabase service-role — SERVEUR UNIQUEMENT.
 * Contourne les RLS. Utilisé par les routes API internes et les crons.
 * Ne jamais exposer côté navigateur.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY manquant."
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
