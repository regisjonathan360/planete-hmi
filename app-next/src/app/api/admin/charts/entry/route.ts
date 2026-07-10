/**
 * POST /api/admin/charts/entry
 * Édition manuelle d'une entrée de classement + recalcul automatique.
 *
 * Body: {
 *   editionId: string,
 *   entryId: string,
 *   action: "edit" | "hide" | "unhide" | "exclude" | "include" | "delete"
 *         | "move_up" | "move_down" | "set_position",
 *   fields?: { title?, artist?, artworkUrl?, url? },
 *   position?: number,
 *   reason?: string
 * }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";

export const dynamic = "force-dynamic";

type EntryAction =
  | "edit"
  | "hide"
  | "unhide"
  | "exclude"
  | "include"
  | "delete"
  | "move_up"
  | "move_down"
  | "set_position";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: {
    editionId?: string;
    entryId?: string;
    action?: EntryAction;
    fields?: { title?: string; artist?: string; artworkUrl?: string; url?: string; genre?: string };
    position?: number;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { editionId, entryId, action } = body;
  if (!editionId || !entryId || !action) {
    return NextResponse.json({ error: "editionId, entryId et action sont requis." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Charger l'entrée cible.
  const { data: entry, error: entryErr } = await supabase
    .from("chart_entries")
    .select("id, chart_edition_id, admin_position, source_position, is_hidden, is_excluded")
    .eq("id", entryId)
    .eq("chart_edition_id", editionId)
    .maybeSingle();

  if (entryErr || !entry) {
    return NextResponse.json({ error: "Entrée introuvable." }, { status: 404 });
  }

  switch (action) {
    case "edit": {
      const f = body.fields ?? {};
      const patch: Record<string, string | null> = {};
      if ("title" in f) patch.display_title = f.title?.trim() || null;
      if ("artist" in f) patch.display_artist = f.artist?.trim() || null;
      if ("artworkUrl" in f) patch.display_artwork_url = f.artworkUrl?.trim() || null;
      if ("url" in f) patch.display_url = f.url?.trim() || null;
      if ("genre" in f) patch.genre = f.genre?.trim() || null;
      await supabase.from("chart_entries").update(patch).eq("id", entryId);
      await logHistory(supabase, editionId, entryId, "edit", auth.user.id, "Champs corrigés.");
      break;
    }
    case "hide":
      await supabase.from("chart_entries").update({ is_hidden: true }).eq("id", entryId);
      break;
    case "unhide":
      await supabase.from("chart_entries").update({ is_hidden: false }).eq("id", entryId);
      break;
    case "exclude":
      await supabase
        .from("chart_entries")
        .update({ is_excluded: true, exclusion_reason: body.reason?.trim() || "Retiré par l'admin." })
        .eq("id", entryId);
      break;
    case "include":
      await supabase
        .from("chart_entries")
        .update({ is_excluded: false, exclusion_reason: null })
        .eq("id", entryId);
      break;
    case "delete":
      await logHistory(supabase, editionId, entryId, "delete", auth.user.id, "Entrée supprimée.");
      await supabase.from("chart_entries").delete().eq("id", entryId);
      break;
    case "set_position": {
      const pos = Number(body.position);
      if (!Number.isFinite(pos) || pos < 1) {
        return NextResponse.json({ error: "Position invalide." }, { status: 400 });
      }
      // Décale : placer l'entrée à `pos`, on lui donne une valeur fractionnaire
      // juste avant la cible; la renumérotation suivante nettoie les positions.
      await supabase
        .from("chart_entries")
        .update({ admin_position: pos - 0.5 })
        .eq("id", entryId);
      break;
    }
    case "move_up":
    case "move_down": {
      const current = (entry.admin_position as number) ?? (entry.source_position as number);
      // Décalage d'un demi-cran pour se glisser avant/après le voisin.
      const delta = action === "move_up" ? -1.5 : 1.5;
      await supabase
        .from("chart_entries")
        .update({ admin_position: current + delta })
        .eq("id", entryId);
      break;
    }
    default:
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }

  // Recalcul automatique des positions (auto-renumérotation).
  const recompute = await recomputeAdminEdition(supabase, editionId, {
    action,
    changedBy: auth.user.id,
  });

  return NextResponse.json({
    status: "ok",
    action,
    recompute,
    message: "Modification enregistrée. Positions recalculées. Publiez pour mettre à jour le site public.",
  });
}

async function logHistory(
  supabase: ReturnType<typeof createAdminClient>,
  editionId: string,
  entryId: string,
  action: string,
  userId: string,
  note: string
) {
  await supabase.from("chart_entry_history").insert({
    chart_edition_id: editionId,
    chart_entry_id: entryId,
    action,
    source: "audiomack",
    is_manual: true,
    note,
    changed_by: userId,
  });
}
