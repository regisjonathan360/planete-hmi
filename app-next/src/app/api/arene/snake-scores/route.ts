import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkApiRateLimit } from "@/lib/arene/rate-limit";

const scoreSchema = z.object({
  score: z.number().int().min(1).max(100000),
  pseudo: z.string().trim().min(1).max(30).default("Joueur"),
  skin: z.number().int().min(0).max(20).default(0),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("snake_scores")
    .select("pseudo, score, skin, played_at")
    .order("score", { ascending: false })
    .order("played_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: "Classement indisponible." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Connecte-toi pour publier ton score." } },
      { status: 401 },
    );
  }

  const rate = checkApiRateLimit(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown", user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: rate.reason } },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "validation_error", message: "Données invalides." } }, { status: 400 });
  }

  const parsed = scoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_error", message: "Score invalide." } }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("snake_scores")
    .insert({ member_id: user.id, ...parsed.data })
    .select("pseudo, score, skin, played_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: "Impossible d'enregistrer le score." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
