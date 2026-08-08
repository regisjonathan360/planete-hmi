import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { recomputeAdminEdition } from "@/lib/charts/admin/recompute-admin-edition";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  editionId: z.string().uuid(),
  entryId: z.string().uuid(),
  action: z.enum([
    "edit",
    "hide",
    "unhide",
    "exclude",
    "include",
    "move_up",
    "move_down",
  ]),
  title: z.string().trim().max(200).optional(),
  artist: z.string().trim().max(300).optional(),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.action === "exclude" && (!value.reason || value.reason.length < 5)) {
    ctx.addIssue({
      code: "custom",
      path: ["reason"],
      message: "Une raison d’exclusion de 5 caractères minimum est requise.",
    });
  }
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Modification invalide.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = createAdminClient();
    const { data: edition, error: editionError } = await supabase
      .from("chart_editions")
      .select("id, status, chart_sources!inner(source_key)")
      .eq("id", input.editionId)
      .eq("chart_sources.source_key", YOUTUBE_HMI_SOURCE_KEY)
      .maybeSingle();
    if (editionError) throw editionError;
    if (!edition) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Édition YouTube introuvable." } },
        { status: 404 }
      );
    }
    if (edition.status === "published" || edition.status === "archived") {
      return NextResponse.json(
        {
          error: {
            code: "precondition_failed",
            message: "Créez d’abord une révision pour modifier cette édition.",
          },
        },
        { status: 412 }
      );
    }

    const { data: entry, error: entryError } = await supabase
      .from("chart_entries")
      .select("id, source_position, admin_position, is_hidden, is_excluded")
      .eq("id", input.entryId)
      .eq("chart_edition_id", input.editionId)
      .maybeSingle();
    if (entryError) throw entryError;
    if (!entry) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Entrée introuvable." } },
        { status: 404 }
      );
    }

    if (input.action === "edit") {
      const { error: updateError } = await supabase
        .from("chart_entries")
        .update({
          display_title: input.title || null,
          display_artist: input.artist || null,
        })
        .eq("id", input.entryId);
      if (updateError) throw updateError;
    } else if (input.action === "hide" || input.action === "unhide") {
      const { error: updateError } = await supabase
        .from("chart_entries")
        .update({ is_hidden: input.action === "hide" })
        .eq("id", input.entryId);
      if (updateError) throw updateError;
    } else if (input.action === "exclude" || input.action === "include") {
      const { error: updateError } = await supabase
        .from("chart_entries")
        .update({
          is_excluded: input.action === "exclude",
          exclusion_reason: input.action === "exclude" ? input.reason : null,
        })
        .eq("id", input.entryId);
      if (updateError) throw updateError;
    } else {
      const { data: candidates, error: candidatesError } = await supabase
        .from("chart_entries")
        .select("id, source_position, admin_position")
        .eq("chart_edition_id", input.editionId)
        .eq("is_hidden", false)
        .eq("is_excluded", false);
      if (candidatesError) throw candidatesError;

      const sorted = (candidates ?? []).sort((a, b) => {
        const aPosition = (a.admin_position as number | null) ?? (a.source_position as number);
        const bPosition = (b.admin_position as number | null) ?? (b.source_position as number);
        return aPosition - bPosition;
      });
      const currentIndex = sorted.findIndex((candidate) => candidate.id === input.entryId);
      const neighbourIndex = input.action === "move_up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex >= 0 && neighbourIndex >= 0 && neighbourIndex < sorted.length) {
        const current = sorted[currentIndex];
        const neighbour = sorted[neighbourIndex];
        const currentPosition =
          (current.admin_position as number | null) ?? (current.source_position as number);
        const neighbourPosition =
          (neighbour.admin_position as number | null) ?? (neighbour.source_position as number);
        const { error: firstMoveError } = await supabase
          .from("chart_entries")
          .update({ admin_position: neighbourPosition })
          .eq("id", current.id);
        if (firstMoveError) throw firstMoveError;
        const { error: secondMoveError } = await supabase
          .from("chart_entries")
          .update({ admin_position: currentPosition })
          .eq("id", neighbour.id);
        if (secondMoveError) throw secondMoveError;
      }
    }

    const recompute = await recomputeAdminEdition(supabase, input.editionId, {
      action: input.action,
      source: "youtube",
      changedBy: auth.user.id,
    });

    await logAudit(supabase, {
      userId: auth.user.id,
      action: `youtube_chart_entry_${input.action}`,
      entityType: "chart_entry",
      entityId: input.entryId,
      newValue: {
        title: input.title,
        artist: input.artist,
        reason: input.reason,
      },
      reason: input.reason,
    });

    return NextResponse.json({ status: "ok", action: input.action, recompute });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json(
      { error: { code: safe.code, message: safe.message } },
      { status: safe.status }
    );
  }
}
