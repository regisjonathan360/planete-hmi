/**
 * POST /api/admin/events/collect
 * Collecte les événements avec progression en temps réel (Server-Sent Events).
 *
 * Chaque source enregistre le résultat de sa dernière collecte
 * (`last_success_at`, `last_found_count`, `last_error`) pour que l'admin voie
 * immédiatement pourquoi une source ne remonte rien.
 */
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeEvents, type EventSourceType } from "@/lib/events/scraper";

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

      const supabase = createAdminClient();
      let currentSourceId: string | null = null;

      try {
        send({ phase: "init", percent: 2, message: "Initialisation de la collecte..." });

        if (!sourceId) {
          send({ phase: "error", percent: 0, message: "Sélectionnez une source." });
          controller.close();
          return;
        }

        send({ phase: "source", percent: 6, message: "Recherche de la source..." });
        const { data: source } = await supabase
          .from("event_sources")
          .select("id, name, slug, scrape_url, source_type")
          .eq("id", sourceId)
          .eq("is_active", true)
          .maybeSingle();

        if (!source) {
          send({
            phase: "error",
            percent: 0,
            message: "Source introuvable ou désactivée. Réactivez-la avant de collecter.",
          });
          controller.close();
          return;
        }
        currentSourceId = source.id as string;

        send({ phase: "scraping", percent: 15, message: `Connexion à ${source.name}...` });

        const sourceType = source.source_type as string | null;
        const { events, warnings } = await scrapeEvents(
          source.slug as string,
          source.scrape_url as string,
          sourceType && sourceType !== "auto" ? (sourceType as EventSourceType) : null,
        );

        send({
          phase: "scraped",
          percent: 40,
          message: `${events.length} événement(s) trouvé(s).`,
          found: events.length,
          warnings: warnings.length > 0 ? warnings : undefined,
        });

        if (events.length === 0) {
          await supabase
            .from("event_sources")
            .update({
              last_scraped_at: new Date().toISOString(),
              last_found_count: 0,
              last_error: warnings[0] ?? "Aucun événement trouvé sur cette page.",
            })
            .eq("id", source.id);

          send({
            phase: "done",
            percent: 100,
            message: "Aucun événement trouvé sur cette source.",
            found: 0,
            inserted: 0,
            source: source.name as string,
            warnings: warnings.length > 0 ? warnings : undefined,
          });
          controller.close();
          return;
        }

        let inserted = 0;
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          const { error } = await supabase.from("events").upsert(
            {
              source_id: source.id,
              source_url: event.sourceUrl,
              source_title: event.title,
              source_image_url: event.imageUrl,
              source_date: event.date,
              source_time: event.time,
              source_location: event.location,
              source_price: event.price,
              // Date normalisée : sert au tri public et au masquage des passés.
              event_date: event.startsAt,
              status: "draft",
            },
            { onConflict: "source_url", ignoreDuplicates: true },
          );

          if (error) {
            warnings.push(`« ${event.title.slice(0, 40)} » ignoré : ${error.message}`);
          } else {
            inserted++;
          }

          send({
            phase: "inserting",
            percent: 40 + Math.round(((i + 1) / events.length) * 55),
            message: `Enregistrement ${i + 1}/${events.length} — ${event.title.slice(0, 45)}`,
            current: i + 1,
            total: events.length,
            inserted,
          });
        }

        const now = new Date().toISOString();
        await supabase
          .from("event_sources")
          .update({
            last_scraped_at: now,
            last_success_at: now,
            last_found_count: events.length,
            last_error: null,
          })
          .eq("id", source.id);

        send({
          phase: "done",
          percent: 100,
          message: `Collecte terminée — ${inserted} nouvel(s) événement(s) sur ${events.length} trouvé(s).`,
          found: events.length,
          inserted,
          source: source.name as string,
          warnings: warnings.length > 0 ? warnings : undefined,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur inconnue pendant la collecte.";

        if (currentSourceId) {
          await supabase
            .from("event_sources")
            .update({ last_scraped_at: new Date().toISOString(), last_error: message })
            .eq("id", currentSourceId);
        }

        send({ phase: "error", percent: 0, message });
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
