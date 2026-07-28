import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/shorts
 * Endpoint public — retourne uniquement la sélection HMI Shorts publiée.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("hmi_shorts")
      .select(
        "id, platform, source_url, external_id, title, creator_name, thumbnail_url, description, display_order"
      )
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("[api/shorts] Erreur Supabase:", error.message);
      return NextResponse.json({ shorts: [] });
    }

    return NextResponse.json({ shorts: data ?? [] });
  } catch (err) {
    console.error("[api/shorts] Erreur inattendue:", err);
    return NextResponse.json({ shorts: [] });
  }
}
