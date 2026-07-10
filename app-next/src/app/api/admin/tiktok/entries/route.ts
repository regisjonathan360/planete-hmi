import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sourceKey = request.nextUrl.searchParams.get("sourceKey");
  if (!sourceKey) {
    return NextResponse.json({ error: "sourceKey est requis." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: edition } = await supabase
    .from("chart_editions")
    .select("id, chart_sources!inner(source_key)")
    .eq("chart_sources.source_key", sourceKey)
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!edition) {
    return NextResponse.json({ entries: [] });
  }

  const { data: entries, error } = await supabase
    .from("chart_entries")
    .select("id, source_position, admin_position, raw_track_title, raw_artist_text, display_title, display_artist, display_artwork_url, is_hidden, is_excluded, exclusion_reason, metric_value")
    .eq("chart_edition_id", edition.id)
    .order("source_position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapped = (entries ?? []).map((e) => ({
    id: e.id,
    source_position: e.source_position,
    admin_position: e.admin_position,
    is_hidden: e.is_hidden,
    is_excluded: e.is_excluded,
    exclusion_reason: e.exclusion_reason,
    metric_value: e.metric_value,
    title: e.display_title ?? e.raw_track_title ?? "Sans titre",
    artist: e.display_artist ?? e.raw_artist_text ?? "Artiste inconnu",
    artwork_url: e.display_artwork_url ?? null,
  }));

  return NextResponse.json({ entries: mapped });
}

type EntryAction = "reorder" | "hide" | "exclude" | "override";

interface EntryUpdateBody {
  entry_id: string;
  action: EntryAction;
  new_position?: number;
  is_hidden?: boolean;
  exclusion_reason?: string;
  override_title?: string;
  override_artist?: string;
  override_artwork_url?: string;
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: EntryUpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const { entry_id, action } = body;
  if (!entry_id || !action) {
    return NextResponse.json({ error: "entry_id et action sont requis." }, { status: 400 });
  }

  const validActions: EntryAction[] = ["reorder", "hide", "exclude", "override"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: entry, error: entryErr } = await supabase
    .from("chart_entries")
    .select("id, chart_edition_id, admin_position, source_position, is_hidden, is_excluded")
    .eq("id", entry_id)
    .maybeSingle();

  if (entryErr || !entry) {
    return NextResponse.json({ error: "Entrée introuvable." }, { status: 404 });
  }

  const editionId = entry.chart_edition_id as string;

  switch (action) {
    case "reorder": {
      const pos = Number(body.new_position);
      if (!Number.isFinite(pos) || pos < 1) {
        return NextResponse.json({ error: "new_position doit être ≥ 1." }, { status: 400 });
      }
      await supabase.from("chart_entries").update({ admin_position: pos - 0.5 }).eq("id", entry_id);
      break;
    }
    case "hide": {
      await supabase.from("chart_entries").update({ is_hidden: body.is_hidden ?? true }).eq("id", entry_id);
      break;
    }
    case "exclude": {
      if (body.exclusion_reason) {
        await supabase.from("chart_entries").update({ is_excluded: true, exclusion_reason: body.exclusion_reason.trim() }).eq("id", entry_id);
      } else {
        await supabase.from("chart_entries").update({ is_excluded: false, exclusion_reason: null }).eq("id", entry_id);
      }
      break;
    }
    case "override": {
      const patch: Record<string, string | null> = {};
      if (body.override_title !== undefined) patch.display_title = body.override_title.trim() || null;
      if (body.override_artist !== undefined) patch.display_artist = body.override_artist.trim() || null;
      if (body.override_artwork_url !== undefined) patch.display_artwork_url = body.override_artwork_url.trim() || null;
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "Au moins un champ override requis." }, { status: 400 });
      }
      await supabase.from("chart_entries").update(patch).eq("id", entry_id);
      break;
    }
  }

  const recompute = await recomputeAdminEdition(supabase, editionId, {
    action,
    source: "tiktok",
    changedBy: auth.user.id,
  });

  return NextResponse.json({ status: "ok", action, entry_id, recompute });
}
