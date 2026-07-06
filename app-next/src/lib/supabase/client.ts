/**
 * Client Supabase côté navigateur.
 * N'utilise QUE des variables publiques (URL + clé anon).
 * Aucune clé secrète ici : la clé secrète reste exclusivement serveur.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
