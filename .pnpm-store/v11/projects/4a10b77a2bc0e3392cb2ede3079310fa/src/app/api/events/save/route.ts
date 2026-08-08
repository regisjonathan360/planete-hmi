/**
 * POST /api/events/save — Sauvegarder un événement
 * DELETE /api/events/save — Retirer un événement sauvegardé
 * GET /api/events/save — Lister les événements sauvegardés de l'utilisateur
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readEventId(request: Request): Promise<string | null> {
  try {
    const body = await request.json();
    const eventId = String(body?.eventId ?? "").trim();
    return UUID_RE.test(eventId) ? eventId : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_events")
    .select("event_id, saved_at, events(id, source_url, source_title, source_image_url, source_date, source_location, display_title, event_date)")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Impossible de charger les événements enregistrés." }, { status: 500 });

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

  const eventId = await readEventId(request);
  if (!eventId) return NextResponse.json({ error: "Identifiant d’événement invalide." }, { status: 400 });

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Événement indisponible." }, { status: 404 });

  const { error } = await supabase
    .from("saved_events")
    .upsert({ user_id: user.id, event_id: eventId }, { onConflict: "user_id,event_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: "L’événement n’a pas pu être enregistré." }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const eventId = await readEventId(request);
  if (!eventId) return NextResponse.json({ error: "Identifiant d’événement invalide." }, { status: 400 });

  const { error } = await supabase
    .from("saved_events")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);

  if (error) return NextResponse.json({ error: "Le ruban n’a pas pu être retiré." }, { status: 500 });
  return NextResponse.json({ removed: true });
}
