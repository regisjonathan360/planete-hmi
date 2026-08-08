/**
 * GET  /api/admin/arene/banned-terms — Liste de tous les termes interdits
 * POST /api/admin/arene/banned-terms — Ajouter un terme interdit
 *
 * Requirements: 10.9, 15.2
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const addTermSchema = z.object({
  term: z
    .string()
    .min(1, "Le terme ne peut pas être vide.")
    .max(100, "Le terme ne doit pas dépasser 100 caractères.")
    .transform((t) => t.trim())
    .refine((t) => t.length >= 1, {
      message: "Le terme ne peut pas être vide après suppression des espaces.",
    }),
});

// ---------------------------------------------------------------------------
// GET — List all banned terms
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
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("banned_terms")
      .select("id, term, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: { code: "database_error", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ terms: data });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Add a banned term
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
    const parsed = addTermSchema.safeParse(body);

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

    const { term } = parsed.data;
    const supabase = createAdminClient();

    // Check total count before inserting (max 500 terms)
    const { count, error: countError } = await supabase
      .from("banned_terms")
      .select("id", { count: "exact", head: true });

    if (countError) {
      return NextResponse.json(
        { error: { code: "database_error", message: countError.message } },
        { status: 500 }
      );
    }

    if ((count ?? 0) >= 500) {
      return NextResponse.json(
        {
          error: {
            code: "limit_reached",
            message: "Limite atteinte : 500 termes interdits maximum.",
          },
        },
        { status: 409 }
      );
    }

    // Insert the term (UNIQUE constraint on `term` prevents duplicates)
    const { data, error } = await supabase
      .from("banned_terms")
      .insert({ term })
      .select("id, term, created_at")
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: {
              code: "duplicate",
              message: "Ce terme est déjà dans la liste des termes interdits.",
            },
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: { code: "database_error", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ term: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "internal_error", message: "Erreur inattendue." } },
      { status: 500 }
    );
  }
}
