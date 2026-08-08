import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  excluded: z.boolean(),
  reason: z.string().trim().max(1000).default(""),
}).superRefine((value, ctx) => {
  if (value.excluded && value.reason.length < 3) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "Indiquez la raison de l’exclusion." });
  }
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const artistId = z.string().uuid().safeParse(id);
  if (!artistId.success) return NextResponse.json({ error: "Identifiant artiste invalide." }, { status: 400 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("set_artist_exclusion", {
    p_artist_id: artistId.data,
    p_excluded: parsed.data.excluded,
    p_reason: parsed.data.reason,
    p_changed_by: auth.user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) {
    const messages: Record<string, { message: string; status: number }> = {
      artist_not_found: { message: "Artiste introuvable.", status: 404 },
      reason_required: { message: "Une raison d’exclusion est obligatoire.", status: 400 },
      missing_params: { message: "Paramètres incomplets.", status: 400 },
    };
    const mapped = messages[result?.message ?? ""] ?? { message: "Exclusion impossible.", status: 500 };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("is_excluded, is_active, exclusion_reason, excluded_at")
    .eq("id", artistId.data)
    .single();

  return NextResponse.json({
    status: "ok",
    excluded: parsed.data.excluded,
    artist,
    message: parsed.data.excluded
      ? "Artiste exclu globalement de toutes les collectes et de tous les compteurs."
      : "Artiste réintégré. Les prochaines collectes pourront de nouveau le comptabiliser.",
  });
}
