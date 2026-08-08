import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
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

  const { data: { user } } = await supabase.auth.getUser();
  let savedIds: string[] = [];
  if (user) {
    const { data: saved } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("user_id", user.id);
    savedIds = (saved ?? []).map((s) => s.event_id as string);
  }

  return (
    <>
      {/* Fond cosmique cohérent avec le reste du site */}
      <div className="grain" aria-hidden="true" />
      <div className="cosmos" aria-hidden="true">
        <div className="cosmos__layer cosmos__stars-distant" data-depth="0.06" />
        <div className="cosmos__layer cosmos__stars-near" data-depth="0.14" />
        <div className="cosmos__glow" />
      </div>

      <SiteHeader />
      <EventsList events={events ?? []} savedIds={savedIds} isLoggedIn={!!user} />
    </>
  );
}
