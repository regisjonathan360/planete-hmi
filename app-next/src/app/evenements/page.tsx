import { createClient } from "@/lib/supabase/server";
import { EventsList } from "./EventsList";

export const dynamic = "force-dynamic";

export default async function EvenementsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, source_url, source_title, source_image_url, source_date, source_time, source_location, source_price, display_title, display_image_url, display_description, category, is_featured, published_at")
    .eq("status", "published")
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(30);

  return <EventsList events={events ?? []} />;
}
