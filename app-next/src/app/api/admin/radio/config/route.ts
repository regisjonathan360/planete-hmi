/**
 * API route pour la configuration de la radio
 * PUT /api/admin/radio/config - Mettre à jour la configuration
 * GET /api/admin/radio/config - Récupérer la configuration
 */
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const configSchema = z.object({
  active_playlist_id: z.string().uuid().optional().nullable(),
  auto_switch_to_chart: z.boolean(),
  chart_source_key: z.string().optional().nullable(),
  preload_count: z.number().int().min(1).max(10),
  crossfade_duration_ms: z.number().int().min(0).max(10000),
  is_live: z.boolean(),
});

export async function GET() {
  await ensureAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("radio_config")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const admin = await ensureAdmin();
  const supabase = await createClient();

  try {
    const body = await request.json();
    const validatedData = configSchema.parse(body);

    // Récupérer l'ID de la config existante
    const { data: existingConfig } = await supabase
      .from("radio_config")
      .select("id")
      .limit(1)
      .single();

    if (!existingConfig) {
      // Créer une nouvelle config si aucune n'existe
      const { data, error } = await supabase
        .from("radio_config")
        .insert({
          ...validatedData,
          updated_by: admin.id,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    // Mettre à jour la config existante
    const { data, error } = await supabase
      .from("radio_config")
      .update({
        ...validatedData,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingConfig.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating radio config:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la mise à jour" },
      { status: 500 }
    );
  }
}
