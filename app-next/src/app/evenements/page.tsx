import { createClient } from "@/lib/supabase/server";
import { EventsList } from "./EventsList";

export const dynamic = "force-dynamic";

export default async function EvenementsPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, source_url, source_title, source_image_url, source_date, source_time, source_location, source_price, display_title, display_image_url, display_description, category, is_featured, published_at, event_date")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);

  // Récupérer les signets de l'utilisateur connecté
  const { data: { user } } = await supabase.auth.getUser();
  let savedIds: string[] = [];
  if (user) {
    const { data: saved } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("user_id", user.id);
    savedIds = (saved ?? []).map((s) => s.event_id as string);
  }

  return <EventsList events={events ?? []} savedIds={savedIds} isLoggedIn={!!user} />;
}
