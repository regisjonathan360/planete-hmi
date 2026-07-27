/**
 * POST /api/admin/events/collect
 * Collecte les événements depuis la source choisie.
 * Body : { sourceId: string }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeEvents } from "@/lib/events/scraper";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const sourceId = body?.sourceId as string | undefined;

    if (!sourceId) {
      return NextResponse.json({ error: "Sélectionnez une source." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: source } = await supabase
      .from("event_sources")
      .select("*")
      .eq("id", sourceId)
      .eq("is_active", true)
      .maybeSingle();

    if (!source) {
      return NextResponse.json({ error: "Source introuvable ou inactive." }, { status: 404 });
    }

    const events = await scrapeEvents(source.slug as string, source.scrape_url as string);

    if (events.length === 0) {
      return NextResponse.json({ message: "Aucun événement trouvé.", source: source.name, found: 0, inserted: 0 });
    }

    let inserted = 0;
    for (const event of events) {
      const { error } = await supabase
        .from("events")
        .upsert({
          source_id: source.id,
          source_url: event.sourceUrl,
          source_title: event.title,
          source_image_url: event.imageUrl,
          source_date: event.date,
          source_time: event.time,
          source_location: event.location,
          source_price: event.price,
          status: "draft",
        }, { onConflict: "source_url", ignoreDuplicates: true });

      if (!error) inserted++;
    }

    await supabase.from("event_sources").update({ last_scraped_at: new Date().toISOString() }).eq("id", source.id);

    return NextResponse.json({ message: "Collecte terminée.", source: source.name, found: events.length, inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de collecte.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
