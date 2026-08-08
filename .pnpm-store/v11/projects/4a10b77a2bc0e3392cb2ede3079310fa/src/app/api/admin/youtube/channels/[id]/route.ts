/**
 * PATCH  /api/admin/youtube/channels/[id] — Mise à jour d'une chaîne
 * DELETE /api/admin/youtube/channels/[id] — Désactivation logique
 *
 * Correction K6 :
 * - Passage au statut active exige une justification
 * - approved_by/approved_at uniquement si statut passe à active
 * - Erreurs sanitisées
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/charts/audit";
import { youtubeChannelTypeSchema } from "@/lib/youtube/schemas";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const channelPatchSchema = z.object({
  channelTitle: z.string().trim().min(1).max(200).optional(),
  channelType: youtubeChannelTypeSchema.optional(),
  isActive: z.boolean().optional(),
  // isVerified is NOT exposed — only /refresh (K2) can set it
  status: z.enum(["active", "paused", "rejected", "pending_review"]).optional(),
  artistId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  approvalReason: z.string().trim().min(10).max(1000).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.status === "active" && (!data.approvalReason || data.approvalReason.trim().length < 10)) {
    ctx.addIssue({
      code: "custom",
      path: ["approvalReason"],
      message: "Une justification d'approbation (min. 10 caractères) est requise pour activer une chaîne.",
    });
  }
  if (data.status === "active" && data.isActive === false) {
    ctx.addIssue({
      code: "custom",
      path: ["isActive"],
      message: "Une chaîne active ne peut pas être désactivée simultanément.",
    });
  }
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Identifiant invalide." } },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = channelPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Données invalides.", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = createAdminClient();

    // Récupérer l'ancien état
    const { data: oldChannel, error: fetchError } = await supabase
      .from("youtube_channels")
      .select("id, status, is_active, is_youtube_verified, channel_type")
      .eq("id", idParsed.data)
      .maybeSingle();

    if (fetchError) {
      const safe = toSafeApiError(fetchError);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!oldChannel) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Chaîne introuvable." } },
        { status: 404 }
      );
    }

    // Construire le patch SQL
    const patch: Record<string, unknown> = {};
    if (input.channelTitle !== undefined) patch.channel_title = input.channelTitle;
    if (input.channelType !== undefined) patch.channel_type = input.channelType;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    // is_youtube_verified is NEVER writable from PATCH — only via /refresh (K2)
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "active") {
        // Ne jamais faire confiance à isVerified envoyé par le client.
        // Seule la valeur en base (mise par K2 refresh) fait foi.
        const isVerified = oldChannel.is_youtube_verified;
        if (!isVerified) {
          return NextResponse.json(
            { error: { code: "precondition_failed", message: "La chaîne doit être vérifiée via YouTube (refresh) pour être activée." } },
            { status: 412 }
          );
        }
        patch.approved_by = auth.user.id;
        patch.approved_at = new Date().toISOString();
        patch.approval_reason = input.approvalReason;
      }
    }
    if (input.artistId !== undefined) patch.artist_id = input.artistId;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.approvalReason !== undefined && input.status !== "active") {
      patch.approval_reason = input.approvalReason;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Aucun champ à modifier." } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("youtube_channels")
      .update(patch)
      .eq("id", idParsed.data)
      .select("id, channel_id, channel_title, status, is_active")
      .single();

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_channel_update",
      entityType: "youtube_channel",
      entityId: idParsed.data,
      oldValue: { status: oldChannel.status, is_active: oldChannel.is_active },
      newValue: patch,
    });

    return NextResponse.json({ channel: data });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  const { id } = await params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Identifiant invalide." } },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("youtube_channels")
      .update({ is_active: false, status: "paused" })
      .eq("id", idParsed.data)
      .select("id, channel_id")
      .maybeSingle();

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
    }
    if (!data) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Chaîne introuvable." } },
        { status: 404 }
      );
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_channel_deactivate",
      entityType: "youtube_channel",
      entityId: idParsed.data,
      newValue: { is_active: false, status: "paused" },
    });

    return NextResponse.json({ success: true, channel: data });
  } catch (err) {
    const safe = toSafeApiError(err);
    return NextResponse.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status });
  }
}
