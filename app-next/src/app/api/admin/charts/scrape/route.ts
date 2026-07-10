/**
 * POST /api/admin/charts/scrape
 * Étape 1 de la collecte : scrape la page Audiomack Haiti et retourne
 * les entrées normalisées au client. Aucune écriture en base.
 *
 * Séparé de /collect pour rester sous le timeout de 30s (Proxied Request)
 * sur le plan Vercel Hobby.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getProvider } from "@/lib/audiomack/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const provider = getProvider();

  let result;
  try {
    result = await provider.fetchChart();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider: provider.name,
        error: err instanceof Error ? err.message : "Erreur inconnue lors du scraping.",
      },
      { status: 200 }
    );
  }

  if (!result.ok || !result.entries.length) {
    return NextResponse.json(
      {
        ok: false,
        provider: provider.name,
        error: result.error ?? "Aucune donnée reçue de la plateforme.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    provider: provider.name,
    entries: result.entries,
    sourceUpdatedAt: result.sourceUpdatedAt ?? null,
  });
}
