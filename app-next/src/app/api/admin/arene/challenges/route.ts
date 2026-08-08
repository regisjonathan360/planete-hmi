/**
 * GET  /api/admin/arene/challenges — List all challenges (active + ended), paginated
 * POST /api/admin/arene/challenges — Create a new challenge
 *
 * Requirements: 6.1, 6.5, 15.2
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { challengeSchema } from "@/lib/arene/validation";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — List challenges (paginated)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
  const status = searchParams.get("status"); // optional filter: active, ended, draft

  const supabase = createAdminClient();

  let query = supabase
    .from("challenges")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status && ["draft", "active", "ended"].includes(status)) {
    query = query.eq("status", status);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur lors de la récupération des défis." } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  });
}

// ---------------------------------------------------------------------------
// POST — Create a challenge
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Corps de requête JSON invalide." } },
      { status: 400 }
    );
  }

  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Données invalides.",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            msg: i.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      title: input.title,
      description: input.description ?? null,
      challenge_type: input.challenge_type,
      target_count: input.target_count,
      reward_points: input.reward_points,
      status: "active",
      starts_at: now,
      ends_at: input.ends_at,
      participant_count: 0,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur lors de la création du défi." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
