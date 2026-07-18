/**
 * POST /api/admin/tiktok/sync-connections
 * Synchronise toutes les connexions TikTok actives (artistes qui ont connecté leur compte).
 * Actualise profil, vidéos et statistiques via Login Kit / Display API.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { syncAllTikTokConnections } from "@/lib/tiktok/user-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const results = await syncAllTikTokConnections();
    const successful = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    const totalVideos = successful.reduce((sum, r) => sum + r.videosUpdated, 0);

    return NextResponse.json({
      status: "ok",
      message: `Synchronisation terminée : ${successful.length} connexion(s) OK, ${failed.length} échoué(es). ${totalVideos} vidéos actualisées.`,
      results: results.map((r) => ({
        connectionId: r.connectionId,
        ok: r.ok,
        videosUpdated: r.videosUpdated,
        error: r.error ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Synchronisation échouée." },
      { status: 500 }
    );
  }
}
