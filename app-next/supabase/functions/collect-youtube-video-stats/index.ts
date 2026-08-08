// YouTube HMI — Vues gagnées en 7 jours (OFFICIAL_API).
// weekly_view_delta = total_actuel - total_semaine_precedente, sur une liste
// blanche de vidéos officielles. Nécessite YOUTUBE_API_KEY (jamais côté client).
import { json } from "../_shared/utils.ts";

Deno.serve(() => {
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (!key) {
    return json({
      status: "error",
      platform: "youtube",
      message: "YOUTUBE_API_KEY manquant : impossible de calculer weekly_view_delta.",
    }, 400);
  }
  // À implémenter : videos.list?part=statistics sur la liste blanche, puis delta.
  return json({
    status: "not_implemented",
    platform: "youtube",
    message: "Collecte weekly_view_delta non encore implémentée.",
  }, 501);
});
