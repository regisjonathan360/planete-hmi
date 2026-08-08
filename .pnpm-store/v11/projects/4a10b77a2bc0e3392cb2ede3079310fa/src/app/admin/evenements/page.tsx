import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { EventsManager } from "./EventsManager";

export const dynamic = "force-dynamic";

export default async function AdminEvenementsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/evenements");

  const supabase = createAdminClient();

  const { data: sources } = await supabase
    .from("event_sources")
    .select(
      "id, name, slug, scrape_url, is_active, source_type, notes, last_scraped_at, last_success_at, last_found_count, last_error",
    )
    .order("is_active", { ascending: false })
    .order("name");

  const { data: events } = await supabase
    .from("events")
    .select("*, event_sources(name, slug)")
    .order("collected_at", { ascending: false })
    .limit(100);

  return (
    <>
      <AdminHeader email={user.email} active="evenements" />
      <main className="admin__main">
        <h1 className="admin__title">Gestion des événements</h1>
        <p className="admin__subtitle">
          Collectez, modifiez et publiez les événements musicaux.
        </p>
        <EventsManager sources={sources ?? []} initialEvents={events ?? []} />
      </main>
    </>
  );
}
