/**
 * POST /api/admin/news/collect
 * Collecte les actualités depuis une source configurée.
 * Body : { sourceId: string }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeChokarella } from "@/lib/news/scraper";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const sourceId = body?.sourceId as string | undefined;

    const supabase = createAdminClient();

    // Si sourceId fourni, utiliser cette source. Sinon, utiliser la première active.
    let source;
    if (sourceId) {
      const { data } = await supabase
        .from("news_sources")
        .select("*")
        .eq("id", sourceId)
        .eq("is_active", true)
        .maybeSingle();
      source = data;
    } else {
      const { data } = await supabase
        .from("news_sources")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      source = data;
    }

    if (!source) {
      return NextResponse.json({ error: "Aucune source active trouvée." }, { status: 404 });
    }

    // Scrape
    const scrapedArticles = await scrapeChokarella(source.scrape_url as string);
    const articles = scrapedArticles.filter((article) => article.categorySlug === "musique");

    if (articles.length === 0) {
      return NextResponse.json({ message: "Aucun article trouvé.", collected: 0 });
    }

    // Synchroniser uniquement les articles confirmés par l'API WordPress Musique.
    // Les champs éditoriaux sont absents du payload afin de préserver la relecture
    // et la publication d'un article déjà enregistré.
    let synchronized = 0;
    const verifiedAt = new Date().toISOString();
    for (const article of articles) {
      const { error } = await supabase
        .from("news_articles")
        .upsert({
          source_id: source.id,
          source_url: article.sourceUrl,
          source_title: article.title,
          source_image_url: article.imageUrl,
          source_excerpt: article.excerpt,
          source_author: article.author,
          source_date: article.date,
          source_section: "musique",
          source_section_verified_at: verifiedAt,
        }, { onConflict: "source_url" });

      if (!error) synchronized++;
    }

    // Mettre à jour last_scraped_at
    await supabase
      .from("news_sources")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", source.id);

    return NextResponse.json({
      message: `Collecte terminée.`,
      source: source.name,
      found: articles.length,
      inserted: synchronized,
      synchronized,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de collecte.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
