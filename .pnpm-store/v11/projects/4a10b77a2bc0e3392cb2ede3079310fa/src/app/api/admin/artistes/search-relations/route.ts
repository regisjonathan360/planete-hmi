import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  query: z.string().trim().min(2).max(100),
  kind: z.enum(["groups", "members"]),
  excludeId: z.string().uuid(),
});

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const validated = querySchema.safeParse({
    query: url.searchParams.get("query"),
    kind: url.searchParams.get("kind"),
    excludeId: url.searchParams.get("excludeId"),
  });
  if (!validated.success) {
    return NextResponse.json(
      { error: "Recherche invalide. Saisissez au moins 2 caractères." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("artists")
    .select("id, name, artist_type")
    .neq("id", validated.data.excludeId)
    .ilike("name", `%${escapeLike(validated.data.query)}%`)
    .order("name")
    .limit(15);

  if (validated.data.kind === "groups") {
    query = query.eq("artist_type", "group");
  } else {
    query = query.neq("artist_type", "group");
  }

  const { data, error } = await query;
  if (error) {
    console.error("[admin/artistes/search-relations] search failed", error.code);
    return NextResponse.json(
      { error: "La recherche d’artistes est temporairement indisponible." },
      { status: 500 },
    );
  }

  return NextResponse.json({ artists: data ?? [] });
}
