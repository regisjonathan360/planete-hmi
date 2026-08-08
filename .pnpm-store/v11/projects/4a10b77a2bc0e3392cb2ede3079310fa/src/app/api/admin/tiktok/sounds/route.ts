import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tiktok/sounds?status=a_verifier
 * Retourne les sons TikTok filtrés par validation_status.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "a_verifier";

  const supabase = createAdminClient();

  const { data: sounds, error } = await supabase
    .from("tiktok_sounds")
    .select("music_id, sound_title, sound_author, total_videos, score, validation_status, first_seen_at")
    .eq("validation_status", status)
    .order("score", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sounds: sounds ?? [] });
}
