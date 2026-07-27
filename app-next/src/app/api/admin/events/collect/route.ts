/**
 * POST /api/admin/events/collect
 * Collecte les événements depuis une source configurée.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeEventbrite } from "@/lib/events/scraper";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const sourceId = body?.sourceId as string | undefined;

    const supabase = createAdminClient();

    let source;
    if (sourceId) {
      const { data } = await supabase.from("event_sources").select("*").eq("id", sourceId).eq("is_active", true).maybeSingle();
      source = data;
    } else {
      const { data } = await supabase.from("event_sources").select("*").eq("is_active", true).limit(1).maybeSingle();
      source = data;
    }

    if (!source) {
      return NextResponse.json({ error: "Aucune source active trouvée." }, { status: 404 });
    }

    const events = await scrapeEventbrite(source.scrape_url as string);

    if (events.length === 0) {
      return NextResponse.json({ message: "Aucun événement trouvé.", collected: 0 });
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
