/**
 * POST /api/events/save — Sauvegarder un événement
 * DELETE /api/events/save — Retirer un événement sauvegardé
 * GET /api/events/save — Lister les événements sauvegardés de l'utilisateur
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { data } = await supabase
    .from("saved_events")
    .select("event_id, saved_at, events(id, source_url, source_title, source_image_url, source_date, source_location, display_title, event_date)")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  // Filtrer les événements passés automatiquement
  const now = new Date();
  const active = (data ?? []).filter((item) => {
    const event = item.events as { event_date?: string } | null;
    if (!event?.event_date) return true; // garder si pas de date
    return new Date(event.event_date) >= now;
  });

  return NextResponse.json({ saved: active });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { eventId } = await request.json();
  if (!eventId) return NextResponse.json({ error: "eventId manquant." }, { status: 400 });

  const { error } = await supabase
    .from("saved_events")
    .upsert({ user_id: user.id, event_id: eventId }, { onConflict: "user_id,event_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: "Erreur." }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { eventId } = await request.json();
  if (!eventId) return NextResponse.json({ error: "eventId manquant." }, { status: 400 });

  await supabase
    .from("saved_events")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);

  return NextResponse.json({ removed: true });
}
