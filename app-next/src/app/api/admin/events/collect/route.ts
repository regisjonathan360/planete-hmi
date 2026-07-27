/**
 * POST /api/admin/events/collect
 * Collecte les événements avec progression en temps réel (Server-Sent Events).
 */
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeEvents } from "@/lib/events/scraper";

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

        if (!sourceId) {
          send({ phase: "error", percent: 0, message: "Sélectionnez une source." });
          controller.close();
          return;
        }

        const supabase = createAdminClient();

        send({ phase: "source", percent: 6, message: "Recherche de la source..." });
        const { data: source } = await supabase
          .from("event_sources")
          .select("*")
          .eq("id", sourceId)
          .eq("is_active", true)
          .maybeSingle();

        if (!source) {
          send({ phase: "error", percent: 0, message: "Source introuvable ou inactive." });
          controller.close();
          return;
        }

        send({ phase: "scraping", percent: 15, message: `Connexion à ${source.name}...` });

        const events = await scrapeEvents(source.slug as string, source.scrape_url as string);

        send({
          phase: "scraped",
          percent: 40,
          message: `${events.length} événement(s) trouvé(s).`,
          found: events.length,
        });

        if (events.length === 0) {
          send({
            phase: "done",
            percent: 100,
            message: "Aucun événement trouvé sur cette source.",
            found: 0,
            inserted: 0,
            source: source.name as string,
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
              status: "draft",
            },
            { onConflict: "source_url", ignoreDuplicates: true }
          );

          if (!error) inserted++;

          send({
            phase: "inserting",
            percent: 40 + Math.round(((i + 1) / events.length) * 55),
            message: `Enregistrement ${i + 1}/${events.length} — ${event.title.slice(0, 45)}`,
            current: i + 1,
            total: events.length,
            inserted,
          });
        }

        await supabase
          .from("event_sources")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", source.id);

        send({
          phase: "done",
          percent: 100,
          message: `Collecte terminée — ${inserted} nouvel(s) événement(s) sur ${events.length} trouvé(s).`,
          found: events.length,
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
