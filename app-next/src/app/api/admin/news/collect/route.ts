/**
 * POST /api/admin/news/collect
 * Collecte les actualités avec progression en temps réel (Server-Sent Events).
 */
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeChokarella } from "@/lib/news/scraper";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const sourceId = body?.sourceId as string | undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send({ phase: "init", percent: 2, message: "Initialisation de la collecte..." });

        const supabase = createAdminClient();

        send({ phase: "source", percent: 6, message: "Recherche de la source..." });
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
          send({ phase: "error", percent: 0, message: "Aucune source active trouvée." });
          controller.close();
          return;
        }

        send({ phase: "scraping", percent: 15, message: `Connexion à ${source.name}...` });

        const articles = await scrapeChokarella(source.scrape_url as string);

        send({
          phase: "scraped",
          percent: 40,
          message: `${articles.length} article(s) trouvé(s).`,
          found: articles.length,
        });

        if (articles.length === 0) {
          send({
            phase: "done",
            percent: 100,
            message: "Aucun article trouvé sur cette source.",
            found: 0,
            inserted: 0,
            source: source.name as string,
          });
          controller.close();
          return;
        }

        let inserted = 0;
        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          const { error } = await supabase.from("news_articles").upsert(
            {
              source_id: source.id,
              source_url: article.sourceUrl,
              source_title: article.title,
              source_image_url: article.imageUrl,
              source_excerpt: article.excerpt,
              source_author: article.author,
              source_date: article.date,
              status: "draft",
            },
            { onConflict: "source_url", ignoreDuplicates: true }
          );

          if (!error) inserted++;

          send({
            phase: "inserting",
            percent: 40 + Math.round(((i + 1) / articles.length) * 55),
            message: `Enregistrement ${i + 1}/${articles.length} — ${article.title.slice(0, 45)}`,
            current: i + 1,
            total: articles.length,
            inserted,
          });
        }

        await supabase
          .from("news_sources")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", source.id);

        send({
          phase: "done",
          percent: 100,
          message: `Collecte terminée — ${inserted} nouvel(le)s actualité(s) sur ${articles.length} trouvée(s).`,
          found: articles.length,
          inserted,
          source: source.name as string,
        });
      } catch (err) {
        send({
          phase: "error",
          percent: 0,
          message: err instanceof Error ? err.message : "Erreur pendant la collecte.",
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
