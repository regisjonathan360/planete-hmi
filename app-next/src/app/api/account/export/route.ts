/**
 * GET /api/account/export
 * RGPD : exporte les données personnelles de l'utilisateur connecté (JSON).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const uid = user.id;

  const [favorites, savedEvents, profile, badges, scores, audit] = await Promise.all([
    supabase.from("user_favorites").select("*").eq("user_id", uid),
    supabase.from("saved_events").select("*").eq("user_id", uid),
    supabase.from("community_profiles").select("*").eq("member_id", uid).maybeSingle(),
    supabase.from("member_badges").select("*").eq("member_id", uid),
    supabase.from("snake_scores").select("*").eq("member_id", uid),
    supabase.from("auth_audit").select("event, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      providers: user.app_metadata?.providers ?? ["email"],
    },
    community_profile: profile.data ?? null,
    favorites: favorites.data ?? [],
    saved_events: savedEvents.data ?? [],
    badges: badges.data ?? [],
    snake_scores: scores.data ?? [],
    auth_history: audit.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="planete-hmi-mes-donnees.json"`,
    },
  });
}
