import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSafeApiError } from "@/lib/youtube/api-error";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  search: z.string().trim().max(120).default(""),
});

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: { code: auth.status === 401 ? "unauthorized" : "forbidden", message: auth.error } },
      { status: auth.status }
    );
  }

  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      search: url.searchParams.get("search") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Recherche invalide." } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    let query = supabase
      .from("tracks")
      .select("id, title, track_artists(artists(name))")
      .order("updated_at", { ascending: false })
      .limit(20);

    if (parsed.data.search) {
      query = query.ilike("title", `%${parsed.data.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const tracks = (data ?? []).map((track) => {
      const links = (track.track_artists as Array<{ artists: unknown }>) ?? [];
      const artists = links
        .map((link) => (link.artists as { name?: string } | null)?.name)
        .filter((name): name is string => Boolean(name))
        .join(", ");
      return {
        id: track.id,
        title: track.title,
        artists: artists || "Artiste non renseigné",
      };
    });

    return NextResponse.json({ tracks });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json(
      { error: { code: safe.code, message: safe.message } },
      { status: safe.status }
    );
  }
}

