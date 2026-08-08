import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { logAudit } from "@/lib/charts/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSafeApiError } from "@/lib/youtube/api-error";
import { youtubeVideoResetSchema } from "@/lib/youtube/video-reset";

export const dynamic = "force-dynamic";

interface ResetResult {
  success: boolean;
  message: string;
  affected_count: number;
  deleted_count: number;
  archived_count: number;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: {
          code: auth.status === 401 ? "unauthorized" : "forbidden",
          message: auth.error,
        },
      },
      { status: auth.status }
    );
  }

  try {
    const parsed = youtubeVideoResetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Confirmation de réinitialisation invalide.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      "reset_youtube_collected_videos",
      {
        p_scope: parsed.data.scope,
        p_confirmation: parsed.data.confirmation,
      }
    );

    if (error) {
      const safe = toSafeApiError(error);
      return NextResponse.json(
        { error: { code: safe.code, message: safe.message } },
        { status: safe.status }
      );
    }

    const result = (Array.isArray(data) ? data[0] : data) as
      | ResetResult
      | null;
    if (!result?.success) {
      const isBusy = result?.message === "collection_in_progress";
      return NextResponse.json(
        {
          error: {
            code: isBusy ? "collection_in_progress" : "reset_refused",
            message: isBusy
              ? "Une collecte YouTube est en cours. Attendez sa fin avant de réinitialiser."
              : "La réinitialisation a été refusée.",
          },
        },
        { status: isBusy ? 409 : 400 }
      );
    }

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_videos_reset",
      entityType: "youtube_video_collection",
      entityId: null,
      newValue: {
        scope: parsed.data.scope,
        affectedCount: result.affected_count,
        deletedCount: result.deleted_count,
        archivedCount: result.archived_count,
      },
      reason: `Réinitialisation administrative: ${parsed.data.scope}`,
    });

    return NextResponse.json({
      success: true,
      scope: parsed.data.scope,
      affectedCount: result.affected_count,
      deletedCount: result.deleted_count,
      archivedCount: result.archived_count,
      snapshotsPreserved: result.archived_count,
    });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json(
      { error: { code: safe.code, message: safe.message } },
      { status: safe.status }
    );
  }
}
