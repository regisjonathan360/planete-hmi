/**
 * GET/PUT /api/admin/radio/config
 * 
 * Récupère ou met à jour la configuration radio
 * Requires: admin role
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RadioConfig } from "@/lib/radio/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // Vérifier que l'utilisateur est admin
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("radio_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching radio config:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération de la configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || null);
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  // Vérifier que l'utilisateur est admin
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body: Partial<RadioConfig> = await request.json();
    const supabase = createAdminClient();

    // Récupérer la config existante
    const { data: existing, error: getError } = await supabase
      .from("radio_config")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (getError) {
      console.error("Error fetching existing config:", getError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour" },
        { status: 500 }
      );
    }

    let result;

    if (existing) {
      // Update
      const { data, error } = await supabase
        .from("radio_config")
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating config:", error);
        return NextResponse.json(
          { error: "Erreur lors de la mise à jour" },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from("radio_config")
        .insert([
          {
            ...body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error creating config:", error);
        return NextResponse.json(
          { error: "Erreur lors de la création" },
          { status: 500 }
        );
      }

      result = data;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
