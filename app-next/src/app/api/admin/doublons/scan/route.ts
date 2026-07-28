import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  scanAdvancedDuplicates,
  type AdvancedDuplicateScanResult,
} from "@/lib/artists/detect-duplicates";
import type { DuplicateSensitivity } from "@/lib/artists/duplicate-similarity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SENSITIVITIES = new Set<DuplicateSensitivity>(["broad", "balanced", "strict"]);

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const sensitivity = typeof body.sensitivity === "string"
    ? body.sensitivity as DuplicateSensitivity
    : "broad";
  if (!SENSITIVITIES.has(sensitivity)) {
    return NextResponse.json({ error: "Niveau de sensibilité invalide." }, { status: 400 });
  }

  try {
    const result: AdvancedDuplicateScanResult = await scanAdvancedDuplicates(
      createAdminClient(),
      sensitivity,
    );
    console.info("[artist-duplicates] advanced_scan_completed", {
      adminId: auth.user.id,
      sensitivity,
      artistsScanned: result.artistsScanned,
      pairsCompared: result.pairsCompared,
      matchesFound: result.matchesFound,
      created: result.created,
      updated: result.updated,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.warn("[artist-duplicates] advanced_scan_failed", {
      adminId: auth.user.id,
      sensitivity,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recherche impossible." },
      { status: 500 },
    );
  }
}
