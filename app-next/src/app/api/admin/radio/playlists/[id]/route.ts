import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
  shuffle_enabled: z.boolean().optional(),
  repeat_enabled: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Données de playlist invalides" }, { status: 400 });
  const { data, error } = await createAdminClient().from("radio_playlists").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: "Impossible de modifier la playlist" }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const supabase = createAdminClient();
  await supabase.from("radio_config").update({ active_playlist_id: null }).eq("active_playlist_id", id);
  const { error } = await supabase.from("radio_playlists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Impossible de supprimer la playlist" }, { status: 500 });
  return NextResponse.json({ success: true });
}
