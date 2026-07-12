/**
 * POST /api/admin/artistes/create
 * Crée un nouvel artiste avec un nom. Retourne l'ID pour rediriger vers l'édition.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "artiste";
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis." }, { status: 400 });

  const supabase = createAdminClient();
  const slug = slugify(name.trim());

  // Vérifier que le slug n'existe pas déjà
  const { data: existing } = await supabase.from("artists").select("id").eq("slug", slug).maybeSingle();
  const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

  const { data, error } = await supabase
    .from("artists")
    .insert({
      name: name.trim(),
      slug: finalSlug,
      haitian_status: "pending_review",
      is_active: false, // Masqué par défaut jusqu'à ce que l'admin l'active
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, slug: finalSlug });
}
