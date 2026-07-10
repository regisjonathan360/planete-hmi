import { NextResponse } from "next/server";
import { syncAllTikTokConnections } from "@/lib/tiktok/user-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  );
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const results = await syncAllTikTokConnections();
    const successful = results.filter((result) => result.ok).length;
    const videosUpdated = results.reduce(
      (total, result) => total + result.videosUpdated,
      0
    );

    return NextResponse.json({
      status: results.every((result) => result.ok) ? "success" : "partial_error",
      connectionsProcessed: results.length,
      connectionsSuccessful: successful,
      videosUpdated,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur interne." },
      { status: 500 }
    );
  }
}

// Vercel Cron appelle les routes planifiees avec GET.
export async function GET(request: Request) {
  return run(request);
}

// Conserve un declenchement manuel possible depuis les outils internes.
export async function POST(request: Request) {
  return run(request);
}
