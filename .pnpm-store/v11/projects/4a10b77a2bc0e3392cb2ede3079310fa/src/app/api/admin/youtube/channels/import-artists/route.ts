import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { logAudit } from "@/lib/charts/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveChannelUrl } from "@/lib/youtube/api-client";
import { toSafeApiError } from "@/lib/youtube/api-error";
import { synchronizeArtistProfilePage } from "@/lib/youtube/artist-channel-sync";
import { createArtistChannelSyncStorage } from "@/lib/youtube/artist-channel-sync-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  cursor: z.string().uuid().nullable().optional(),
});

const PAGE_SIZE = 25;

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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Corps de requête invalide." } },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Paramètres d’import invalides.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const result = await synchronizeArtistProfilePage(
      createArtistChannelSyncStorage(supabase),
      parsed.data.cursor ?? null,
      PAGE_SIZE,
      resolveChannelUrl
    );

    await logAudit(supabase, {
      userId: auth.user.id,
      action: "youtube_artist_profiles_sync",
      entityType: "youtube_channel",
      entityId: null,
      newValue: {
        profilesScanned: result.profilesScanned,
        urlsDetected: result.urlsDetected,
        created: result.created,
        alreadyLinked: result.alreadyLinked,
        linkedExisting: result.linkedExisting,
        duplicateProfileUrls: result.duplicateProfileUrls,
        conflicts: result.conflicts,
        errors: result.errors,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json(
      { error: { code: safe.code, message: safe.message } },
      { status: safe.status }
    );
  }
}
