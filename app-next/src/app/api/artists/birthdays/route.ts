/**
 * GET /api/artists/birthdays
 * Retourne les artistes dont l'anniversaire est aujourd'hui ou dans les 7 prochains jours.
 * Utilisé par la section "Anniversaires des artistes" dans la page actualités.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  // Récupérer les artistes avec une date de naissance définie et actifs
  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, slug, image_url, birth_date, tags")
    .eq("is_active", true)
    .not("birth_date", "is", null);

  if (!artists?.length) {
    return NextResponse.json({ birthdays: [] });
  }

  // Filtrer côté JS : artistes dont le mois+jour = aujourd'hui ou dans les 7 prochains jours
  const upcoming = artists
    .map((a) => {
      const bd = new Date(a.birth_date as string);
      const bMonth = bd.getMonth() + 1;
      const bDay = bd.getDate();
      // Calculer le prochain anniversaire
      let nextBday = new Date(today.getFullYear(), bMonth - 1, bDay);
      if (nextBday < today) {
        nextBday = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
      }
      const daysUntil = Math.floor((nextBday.getTime() - today.getTime()) / 86400000);
      return { ...a, daysUntil, isToday: daysUntil === 0 };
    })
    .filter((a) => a.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return NextResponse.json({
    birthdays: upcoming.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      imageUrl: a.image_url,
      tags: a.tags ?? [],
      isToday: a.isToday,
      daysUntil: a.daysUntil,
    })),
  });
}
