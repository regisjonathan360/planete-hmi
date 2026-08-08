/**
 * GET  /api/admin/arene/battles — Liste paginée de toutes les battles (actives + terminées)
 * POST /api/admin/arene/battles — Créer une nouvelle battle
 *
 * Requirements: 5.1, 15.2
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { battleSchema } from "@/lib/arene/validation";
import { parsePagination, buildPaginationMeta } from "@/lib/arene/pagination";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — List all battles (active + ended), paginated
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const url = new URL(request.url);
    const { page, pageSize } = parsePagination(url.searchParams);
    const status = url.searchParams.get("status"); // optional filter: active, ended, cancelled

    const supabase = createAdminClient();
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("battles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (status && ["active", "ended", "cancelled"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "database_error", message: error.message } },
        { status: 500 }
      );
    }

    const pagination = buildPaginationMeta(count ?? 0, page, pageSize);

    return NextResponse.json({ battles: data, pagination });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new battle
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const body = await request.json();
    const parsed = battleSchema.safeParse(body);

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

    // Calculate ends_at from starts_at (now) + duration_hours
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + input.duration_hours * 60 * 60 * 1000);

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("battles")
      .insert({
        title: input.title,
        description: input.description ?? null,
        side_a_type: input.side_a_type,
        side_a_id: input.side_a_id,
        side_a_label: input.side_a_label,
        side_b_type: input.side_b_type,
        side_b_id: input.side_b_id,
        side_b_label: input.side_b_label,
        duration_hours: input.duration_hours,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        created_by: auth.user.id,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: "database_error", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ battle: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}
