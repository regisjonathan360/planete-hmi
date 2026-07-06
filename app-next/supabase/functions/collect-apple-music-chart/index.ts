// Apple Music — OFFICIAL_API.
// Test du storefront `ht` obligatoire. Aucune bascule silencieuse.
// Clé privée Apple exclusivement côté serveur.
import { json } from "../_shared/utils.ts";

Deno.serve(async () => {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKey = Deno.env.get("APPLE_PRIVATE_KEY");
  const storefront = Deno.env.get("APPLE_STOREFRONT") ?? "ht";

  if (!teamId || !keyId || !privateKey) {
    return json({
      status: "error",
      platform: "apple_music",
      message: "Clés Apple manquantes (APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY).",
    }, 400);
  }

  // À implémenter :
  //  1. Générer le Developer Token (JWT ES256, ttl 6 mois max).
  //  2. GET /v1/catalog/{storefront}/charts?types=songs&limit=200
  //  3. Enregistrer le résultat du test storefront.
  //  4. Si `ht` ne retourne pas de chart -> basculer sur Worldwide explicitement.
  return json({
    status: "not_implemented",
    platform: "apple_music",
    storefront,
    message: "Collecte Apple Music non encore implémentée (token + test storefront).",
  }, 501);
});
