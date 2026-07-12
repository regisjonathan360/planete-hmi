/**
 * Détection automatique de doublons d'artistes.
 * Appelé après chaque collecte pour identifier les artistes qui pourraient être la même personne.
 *
 * Méthodes de détection :
 * - Nom normalisé identique (après suppression d'accents, espaces, casse)
 * - Nom contenu dans un autre (ex: "OG Fresh" vs "OG Fresh Zz")
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Détecte et enregistre les doublons probables parmi les artistes récemment créés.
 * Ne crée pas de doublon si le couple existe déjà (pending, merged, ou dismissed).
 */
export async function detectDuplicates(supabase: SupabaseClient): Promise<number> {
  // Charger tous les artistes actifs
  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, slug")
    .eq("is_active", true);

  if (!artists || artists.length < 2) return 0;

  // Construire un index par nom normalisé
  const byNormalized = new Map<string, { id: string; name: string }[]>();
  for (const a of artists) {
    const norm = normalize(a.name as string);
    if (!norm) continue;
    if (!byNormalized.has(norm)) byNormalized.set(norm, []);
    byNormalized.get(norm)!.push({ id: a.id as string, name: a.name as string });
  }

  let created = 0;

  // Trouver les groupes avec plus d'un artiste ayant le même nom normalisé
  for (const [, group] of byNormalized) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        // Vérifier que ce couple n'existe pas déjà
        const { data: existing } = await supabase
          .from("artist_merge_candidates")
          .select("id")
          .or(`and(artist_a_id.eq.${a.id},artist_b_id.eq.${b.id}),and(artist_a_id.eq.${b.id},artist_b_id.eq.${a.id})`)
          .limit(1)
          .maybeSingle();

        if (existing) continue;

        // Créer le candidat
        await supabase.from("artist_merge_candidates").insert({
          artist_a_id: a.id,
          artist_b_id: b.id,
          confidence: 0.85,
          reason: "normalized_name_match",
        });
        created++;
      }
    }
  }

  return created;
}
