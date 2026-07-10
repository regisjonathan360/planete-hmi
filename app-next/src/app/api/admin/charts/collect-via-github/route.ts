/**
 * POST /api/admin/charts/collect-via-github
 * Déclenche la GitHub Action de collecte Audiomack en un clic.
 * 
 * La GitHub Action :
 * 1. Scrape Audiomack depuis une IP GitHub (non bloquée)
 * 2. Envoie les entrées à /api/admin/charts/collect-local
 * 3. Le classement est mis à jour en brouillon
 *
 * Cette route retourne immédiatement après le trigger.
 * Le classement se met à jour en ~30-60s en arrière-plan.
 *
 * Authentifié par session admin.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const dynamic = "force-dynamic";

const GITHUB_REPO = "regisjonathan360/planete-hmi";
const WORKFLOW_FILE = "audiomack-collect.yml";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Source : "chart" (Top Songs) ou "playlist" (Weekly)
  let source = "chart";
  try {
    const body = await request.json();
    if (body?.source === "playlist" || body?.source === "chart") {
      source = body.source;
    }
  } catch {
    // corps vide accepté
  }

  const token = process.env.GITHUB_PAT;
  if (!token) {
    return NextResponse.json(
      { status: "error", error: "GITHUB_PAT non configuré. Ajoutez un Personal Access Token GitHub dans les variables Vercel." },
      { status: 200 }
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main", inputs: { source } }),
    }
  );

  if (res.status === 204 || res.ok) {
    const label = source === "playlist" ? "Playlist Weekly" : "Top Songs Chart";
    return NextResponse.json({
      status: "triggered",
      message: `Collecte lancée depuis « ${label} » ! Le classement se mettra à jour dans ~1 minute. Rafraîchissez ensuite.`,
    });
  }

  const text = await res.text();
  return NextResponse.json(
    { status: "error", error: `GitHub API a répondu ${res.status}: ${text}` },
    { status: 200 }
  );
}
