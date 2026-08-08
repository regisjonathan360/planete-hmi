/**
 * GET /api/news — Articles publiés (public)
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("news_articles")
    .select("id, source_url, source_title, source_image_url, source_excerpt, source_author, source_date, display_title, display_image_url, display_excerpt, category, is_featured, published_at, news_sources(name, slug)", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Erreur de chargement." }, { status: 500 });
  }

  return NextResponse.json({ articles: data, total: count });
}
