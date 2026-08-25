/**
 * Client Supabase service-role — SERVEUR UNIQUEMENT.
 * Contourne les RLS. Utilisé par les routes API internes et les crons.
 * Ne jamais exposer côté navigateur.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Nouvelle nomenclature (SUPABASE_SECRET_KEY) avec repli sur l'ancienne
  // (SUPABASE_SERVICE_ROLE_KEY) pour compatibilité des déploiements existants.
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) manquant."
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
