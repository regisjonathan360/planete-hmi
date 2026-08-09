/**
 * POST /api/admin/news/collect
 * Collecte les actualités avec progression en temps réel (Server-Sent Events).
 */
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeChokarella } from "@/lib/news/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
        let sourceError: { message: string } | null = null;
        if (sourceId) {
          const { data, error } = await supabase
            .from("news_sources")
            .select("*")
            .eq("id", sourceId)
            .eq("is_active", true)
            .maybeSingle();
          source = data;
          sourceError = error;
        } else {
          const { data, error } = await supabase
            .from("news_sources")
            .select("*")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          source = data;
          sourceError = error;
        }

        if (sourceError) {
          throw new Error(`Impossible de charger la source : ${sourceError.message}`);
        }

        if (!source) {
          send({ phase: "error", percent: 0, message: "Aucune source active trouvée." });
          controller.close();
          return;
        }

        send({ phase: "scraping", percent: 15, message: `Connexion à ${source.name}...` });
        console.info("[news-collect] Début", {
          sourceId: source.id,
          sourceName: source.name,
        });

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
        let repaired = 0;
        let skipped = 0;
        let failed = 0;
        const verifiedAt = new Date().toISOString();

        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];

          // `source_section` est la preuve de provenance : toutes les lectures
          // (admin et public) filtrent sur `source_section = 'musique'`. Sans
          // elle, l'article est enregistré mais invisible partout.
          const { data: insertedRows, error } = await supabase
            .from("news_articles")
            .upsert(
              {
                source_id: source.id,
                source_url: article.sourceUrl,
                source_title: article.title,
                source_image_url: article.imageUrl,
                source_excerpt: article.excerpt,
                source_author: article.author,
                source_date: article.date,
                source_section: article.categorySlug,
                source_section_verified_at: verifiedAt,
                status: "draft",
              },
              { onConflict: "source_url", ignoreDuplicates: false }
            )
            .select("id");

          // Toujours forcer la mise à jour de l'image si on en a une
          // (couvre le cas où l'upsert a ignoré la mise à jour)
          if (article.imageUrl) {
            await supabase
              .from("news_articles")
              .update({ source_image_url: article.imageUrl })
              .eq("source_url", article.sourceUrl)
              .or("source_image_url.is.null,source_image_url.eq.");
            repaired++;
          }

          if (error) {
            failed++;
            console.error("[news-collect] Échec d'enregistrement", {
              sourceUrl: article.sourceUrl,
              message: error.message,
            });
          } else if (insertedRows && insertedRows.length > 0) {
            inserted++;
          } else {
            // Déjà en base. On ne touche à rien d'éditorial, mais on tamponne
            // la provenance si elle manque : sinon les articles collectés
            // avant ce correctif restent invisibles pour toujours.
            const { data: repairedRows, error: repairError } = await supabase
              .from("news_articles")
              .update({
                source_section: article.categorySlug,
                source_section_verified_at: verifiedAt,
              })
              .eq("source_url", article.sourceUrl)
              .is("source_section", null)
              .select("id");

            if (repairError) {
              console.error("[news-collect] Provenance non réparée", {
                sourceUrl: article.sourceUrl,
                message: repairError.message,
              });
            }

            if (repairedRows && repairedRows.length > 0) repaired++;
            else skipped++;
          }

          send({
            phase: "inserting",
            percent: 40 + Math.round(((i + 1) / articles.length) * 55),
            message: `Enregistrement ${i + 1}/${articles.length} — ${article.title.slice(0, 45)}`,
            current: i + 1,
            total: articles.length,
            inserted,
            repaired,
            skipped,
            failed,
          });
        }

        const { error: updateSourceError } = await supabase
          .from("news_sources")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", source.id);

        if (updateSourceError) {
          console.error("[news-collect] Date de collecte non mise à jour", {
            sourceId: source.id,
            message: updateSourceError.message,
          });
        }

        console.info("[news-collect] Terminé", {
          sourceId: source.id,
          found: articles.length,
          inserted,
          repaired,
          skipped,
          failed,
        });

        // Le compte rendu distingue les cas : avant, tout était compté comme
        // « inséré » même quand l'upsert ignorait un doublon.
        const details = [`${inserted} nouvelle(s)`];
        if (repaired > 0) details.push(`${repaired} rendue(s) visible(s)`);
        if (skipped > 0) details.push(`${skipped} déjà en base`);
        if (failed > 0) details.push(`${failed} en échec`);

        send({
          phase: "done",
          percent: 100,
          message: `Collecte terminée — ${details.join(", ")} sur ${articles.length} trouvée(s).`,
          found: articles.length,
          inserted,
          repaired,
          skipped,
          failed,
          source: source.name as string,
        });
      } catch (err) {
        console.error("[news-collect] Échec", err);
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
