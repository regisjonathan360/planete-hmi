/**
 * GET  /api/admin/news/articles — Liste des articles (admin)
 * PATCH /api/admin/news/articles — Mise à jour d'un article
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // draft, published, archived, rejected

  const supabase = createAdminClient();
  let query = supabase
    .from("news_articles")
    .select("*, news_sources(name, slug)")
    .eq("source_section", "musique")
    .order("collected_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ articles: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID manquant." }, { status: 400 });
    }

    // Whitelist des champs modifiables
    const allowed: Record<string, unknown> = {};
    if (updates.displayTitle !== undefined) allowed.display_title = updates.displayTitle;
    if (updates.displayImageUrl !== undefined) allowed.display_image_url = updates.displayImageUrl;
    if (updates.displayExcerpt !== undefined) allowed.display_excerpt = updates.displayExcerpt;
    if (updates.category !== undefined) allowed.category = updates.category;
    if (updates.status !== undefined) {
      allowed.status = updates.status;
      if (updates.status === "published") {
        allowed.published_at = new Date().toISOString();
      }
    }
    if (updates.isFeatured !== undefined) allowed.is_featured = updates.isFeatured;
    if (updates.sortOrder !== undefined) allowed.sort_order = updates.sortOrder;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Aucun champ à modifier." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("news_articles")
      .update(allowed)
      .eq("id", id)
      .eq("source_section", "musique")
      .select("id, source_title, display_title, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ article: data });
  } catch {
    return NextResponse.json({ error: "Erreur de mise à jour." }, { status: 500 });
  }
}
