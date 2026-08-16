import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectDeezerChart } from "@/lib/deezer/collect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  try {
    const result = await collectDeezerChart(createAdminClient());
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: error instanceof Error ? error.message : "Collecte Deezer impossible." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
