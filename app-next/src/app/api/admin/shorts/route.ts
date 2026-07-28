import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { logAudit } from "@/lib/charts/audit";
import {
  createHmiShortSchema,
  fetchHmiShortMetadata,
  parseHmiShortUrl,
} from "@/lib/hmi-shorts";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hmi_shorts")
    .select(
      "id, platform, source_url, external_id, title, creator_name, thumbnail_url, description, display_order, is_published, published_at, created_at, updated_at",
    )
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/shorts] listing failed", error.code);
    return NextResponse.json(
      { error: "Impossible de charger les HMI Shorts." },
      { status: 500 },
    );
  }

  return NextResponse.json({ shorts: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const validated = createHmiShortSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: firstIssue(validated.error) },
      { status: 400 },
    );
  }

  let parsedUrl;
  try {
    parsedUrl = parseHmiShortUrl(validated.data.url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "URL non prise en charge." },
      { status: 400 },
    );
  }

  const metadata = await fetchHmiShortMetadata(parsedUrl);
  const title =
    validated.data.title ||
    metadata.title ||
    `Short ${parsedUrl.platform === "youtube" ? "YouTube" : parsedUrl.platform}`;
  const publishedAt = validated.data.isPublished ? new Date().toISOString() : null;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("hmi_shorts")
    .insert({
      platform: parsedUrl.platform,
      source_url: parsedUrl.canonicalUrl,
      external_id: parsedUrl.externalId,
      title,
      creator_name: validated.data.creatorName ?? metadata.creatorName,
      thumbnail_url: metadata.thumbnailUrl,
      description: validated.data.description,
      display_order: validated.data.displayOrder,
      is_published: validated.data.isPublished,
      published_at: publishedAt,
      created_by: auth.user.id,
    })
    .select(
      "id, platform, source_url, external_id, title, creator_name, thumbnail_url, description, display_order, is_published, published_at, created_at, updated_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Cette vidéo existe déjà dans HMI Shorts." },
        { status: 409 },
      );
    }
    console.error("[admin/shorts] insert failed", error.code);
    return NextResponse.json(
      { error: "Impossible d’ajouter cette vidéo." },
      { status: 500 },
    );
  }

  await logAudit(supabase, {
    userId: auth.user.id,
    action: "HMI_SHORT_CREATED",
    entityType: "hmi_short",
    entityId: data.id,
    newValue: {
      platform: data.platform,
      sourceUrl: data.source_url,
      isPublished: data.is_published,
    },
  });

  return NextResponse.json({ short: data }, { status: 201 });
}
