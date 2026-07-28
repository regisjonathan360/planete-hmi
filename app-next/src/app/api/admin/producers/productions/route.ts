/**
 * Gestion manuelle des crédits de production.
 *
 * POST   — rattache (ou met à jour) un producteur à une chanson.
 * PATCH  — valide / dévalide un crédit existant.
 * DELETE — supprime un crédit.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = new Set(["producer", "beatmaker", "co-producer", "executive_producer"]);

const RPC_ERRORS: Record<string, string> = {
  invalid_role: "Rôle de production inconnu.",
  producer_not_found: "Producteur introuvable.",
  track_not_found: "Chanson introuvable.",
};

function readUuid(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value.trim()) ? value.trim() : null;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const producerId = readUuid((body as Record<string, unknown>).producerId);
  const trackId = readUuid((body as Record<string, unknown>).trackId);
  const rawRole = String((body as Record<string, unknown>).role ?? "producer");

  if (!producerId) return NextResponse.json({ error: "producerId invalide." }, { status: 400 });
  if (!trackId) return NextResponse.json({ error: "trackId invalide." }, { status: 400 });
  if (!ROLES.has(rawRole)) return NextResponse.json({ error: "role invalide." }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("link_artist_production", {
    p_producer_id: producerId,
    p_track_id: trackId,
    p_role: rawRole,
    p_credit_source: "manual_admin",
    p_credit_note: null,
    p_confidence: 1,
    // Un crédit saisi par un administrateur est vérifié par définition.
    p_is_verified: true,
    p_created_by: auth.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) {
    const code = String(result?.message ?? "unknown");
    return NextResponse.json({ error: RPC_ERRORS[code] ?? "Rattachement refusé." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, productionId: result.production_id });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const productionId = readUuid((body as Record<string, unknown> | null)?.productionId);
  const isVerified = (body as Record<string, unknown> | null)?.isVerified;

  if (!productionId) {
    return NextResponse.json({ error: "productionId invalide." }, { status: 400 });
  }
  if (typeof isVerified !== "boolean") {
    return NextResponse.json({ error: "isVerified doit être un booléen." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("artist_productions")
    .update({ is_verified: isVerified, updated_at: new Date().toISOString() })
    .eq("id", productionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const productionId = readUuid(new URL(request.url).searchParams.get("productionId"));
  if (!productionId) {
    return NextResponse.json({ error: "productionId invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("artist_productions").delete().eq("id", productionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
