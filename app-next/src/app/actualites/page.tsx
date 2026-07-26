import { createClient } from "@/lib/supabase/server";
import { NewsList } from "./NewsList";

export const dynamic = "force-dynamic";

export default async function ActualitesPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("news_articles")
    .select("id, source_url, source_title, source_image_url, source_excerpt, source_author, source_date, display_title, display_image_url, display_excerpt, category, is_featured, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);

  return <NewsList articles={articles ?? []} />;
}
