import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ValidationActionSchema } from "@/lib/tiktok/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = ValidationActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const { music_id, status } = parsed.data;
  const supabase = createAdminClient();

  // Vérifier que le son existe
  const { data: sound, error: findError } = await supabase
    .from("tiktok_sounds")
    .select("id")
    .eq("music_id", music_id)
    .maybeSingle();

  if (findError || !sound) {
    return NextResponse.json({ error: `Son introuvable : ${music_id}` }, { status: 404 });
  }

  // Mettre à jour le statut de validation
  const { error: updateError } = await supabase
    .from("tiktok_sounds")
    .update({ validation_status: status, last_updated_at: new Date().toISOString() })
    .eq("music_id", music_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", music_id, validation_status: status });
}
