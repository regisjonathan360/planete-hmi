/**
 * GET  /api/admin/arene/badges — Liste tous les badges
 * POST /api/admin/arene/badges — Créer un nouveau badge
 *
 * Requirements: 8.4, 8.5, 15.2
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { badgeSchema } from "@/lib/arene/validation";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — List all badges
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
    const type = url.searchParams.get("type"); // optional filter by badge_type

    const supabase = createAdminClient();

    let query = supabase
      .from("badges")
      .select("*")
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("badge_type", type);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "database_error", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ badges: data });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new badge
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
    const parsed = badgeSchema.safeParse(body);

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

    const { data, error } = await supabase
      .from("badges")
      .insert({
        name: input.name,
        description: input.description,
        icon_url: input.icon_url,
        badge_type: input.badge_type ?? "special",
        is_special: input.is_special ?? (input.badge_type === "special" || input.badge_type === undefined),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: "database_error", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ badge: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}
