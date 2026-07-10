/**
 * GET /api/admin/export-artists
 * Exporte tous les artistes en CSV pour compléter les URLs plateformes.
 * Protégé par CRON_SECRET (Bearer token).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("artists")
    .select("id, name, slug, image_url, haitian_status, is_active")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build CSV
  const header = "id,name,slug,haitian_status,is_active,youtube_url,spotify_url,apple_music_url,tiktok_url";
  const rows = (data ?? []).map((a) => {
    const name = String(a.name).replace(/"/g, '""');
    return `${a.id},"${name}",${a.slug},${a.haitian_status},${a.is_active},,,,`;
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=planete-hmi-artists.csv",
    },
  });
}
