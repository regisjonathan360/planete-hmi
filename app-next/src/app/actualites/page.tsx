import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { NewsList } from "./NewsList";
import { BirthdayPlanet } from "@/components/BirthdayPlanet";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Actualités",
  description:
    "Actualités de la musique haïtienne : sorties, interviews, tendances et coulisses de Planète HMI.",
};

export default async function ActualitesPage() {
  const supabase = await createClient();
  
  // Récupérer les artistes avec anniversaires à venir (TOUS, même décédés - ils seront séparés)
  const { data: birthdays } = await supabase
    .from("artists")
    .select("id, name, slug, image_url, birth_date, tags, is_deceased")
    .eq("is_active", true)
    .not("birth_date", "is", null);
  
  // Récupérer les articles
  const { data: articles } = await supabase
    .from("news_articles")
    .select("id, source_url, source_title, source_image_url, source_excerpt, source_author, source_date, display_title, display_image_url, display_excerpt, category, is_featured, published_at")
    .eq("status", "published")
    .eq("source_section", "musique")
    .order("published_at", { ascending: false })
    .limit(30);

  // Préparer les données d'anniversaires
  const today = new Date();
  const allUpcomingBirthdays = (birthdays ?? [])
    .map((a) => {
      const bd = new Date(a.birth_date as string);
      const bMonth = bd.getMonth() + 1;
      const bDay = bd.getDate();
      let nextBday = new Date(today.getFullYear(), bMonth - 1, bDay);
      if (nextBday < today) {
        nextBday = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
      }
      const daysUntil = Math.floor((nextBday.getTime() - today.getTime()) / 86400000);
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        imageUrl: a.image_url,
        isToday: daysUntil === 0,
        daysUntil,
        isDeceased: !!a.is_deceased,
      };
    })
    .filter((a) => a.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Séparer vivants et décédés
  const livingBirthdays = allUpcomingBirthdays.filter(a => !a.isDeceased);
  const deceasedBirthdays = allUpcomingBirthdays.filter(a => a.isDeceased);

  return (
    <>
      <NewsList 
        articles={articles ?? []} 
        livingBirthdays={livingBirthdays} 
        deceasedBirthdays={deceasedBirthdays}
      />
    </>
  );
}
