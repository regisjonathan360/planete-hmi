import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { NewsManager } from "./NewsManager";

export const dynamic = "force-dynamic";

export default async function AdminActualitesPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/actualites");

  const supabase = createAdminClient();

  // Charger les sources et les articles
  const { data: sources } = await supabase
    .from("news_sources")
    .select("id, name, slug, scrape_url, is_active, last_scraped_at")
    .order("name");

  const { data: articles } = await supabase
    .from("news_articles")
    .select("*, news_sources(name, slug)")
    .order("collected_at", { ascending: false })
    .limit(100);

  return (
    <>
      <AdminHeader email={user.email} active="actualites" />
      <main className="admin__main">
        <h1 className="admin__title">Gestion des actualités</h1>
        <p className="admin__subtitle">
          Collectez, modifiez et publiez les actualités depuis vos sources.
        </p>
        <NewsManager
          sources={sources ?? []}
          initialArticles={articles ?? []}
        />
      </main>
    </>
  );
}
