/**
 * GET /api/charts/audiomack — lecture publique du classement Audiomack.
 * Ne retourne jamais de clé, secret ou réponse OAuth brute.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicChart } from "@/lib/audiomack/snapshot-service";

export const dynamic = "force-dynamic";
export const revalidate = 300; // cache 5 min

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const supabase = await createClient();
  const chart = await getPublicChart(supabase, limit);

  if (!chart) {
    return NextResponse.json(
      { platform: "audiomack", countryCode: "HT", chartName: "Weekly 100: Haiti", entries: [], isStale: true, error: "Aucun classement disponible." },
      { status: 200 }
    );
  }

  return NextResponse.json(chart);
}
