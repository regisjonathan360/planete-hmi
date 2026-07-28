import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { logAudit } from "@/lib/charts/audit";
import { updateHmiShortSchema } from "@/lib/hmi-shorts";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const validated = updateHmiShortSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: current, error: readError } = await supabase
    .from("hmi_shorts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    console.error("[admin/shorts] read failed", readError.code);
    return NextResponse.json({ error: "Impossible de modifier ce Short." }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "HMI Short introuvable." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (validated.data.title !== undefined) patch.title = validated.data.title;
  if (validated.data.creatorName !== undefined) {
    patch.creator_name = validated.data.creatorName;
  }
  if (validated.data.description !== undefined) {
    patch.description = validated.data.description;
  }
  if (validated.data.displayOrder !== undefined) {
    patch.display_order = validated.data.displayOrder;
  }
  if (validated.data.isPublished !== undefined) {
    patch.is_published = validated.data.isPublished;
    patch.published_at = validated.data.isPublished
      ? current.published_at ?? new Date().toISOString()
      : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hmi_shorts")
    .update(patch)
    .eq("id", id)
    .select(
      "id, platform, source_url, external_id, title, creator_name, thumbnail_url, description, display_order, is_published, published_at, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("[admin/shorts] update failed", error.code);
    return NextResponse.json({ error: "Impossible de modifier ce Short." }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: auth.user.id,
    action: "HMI_SHORT_UPDATED",
    entityType: "hmi_short",
    entityId: id,
    oldValue: {
      title: current.title,
      isPublished: current.is_published,
      displayOrder: current.display_order,
    },
    newValue: {
      title: data.title,
      isPublished: data.is_published,
      displayOrder: data.display_order,
    },
  });

  return NextResponse.json({ short: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: current, error: readError } = await supabase
    .from("hmi_shorts")
    .select("id, platform, source_url, title, is_published")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    console.error("[admin/shorts] delete read failed", readError.code);
    return NextResponse.json({ error: "Impossible de supprimer ce Short." }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "HMI Short introuvable." }, { status: 404 });
  }

  const { error } = await supabase.from("hmi_shorts").delete().eq("id", id);
  if (error) {
    console.error("[admin/shorts] delete failed", error.code);
    return NextResponse.json({ error: "Impossible de supprimer ce Short." }, { status: 500 });
  }

  await logAudit(supabase, {
    userId: auth.user.id,
    action: "HMI_SHORT_DELETED",
    entityType: "hmi_short",
    entityId: id,
    oldValue: current,
  });

  return NextResponse.json({ status: "deleted" });
}
