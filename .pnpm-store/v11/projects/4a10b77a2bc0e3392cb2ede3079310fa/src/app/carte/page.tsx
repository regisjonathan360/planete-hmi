import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { HaitiMapPage, type MapArtist } from "./HaitiMapPage";
import { resolveFallbackAvatars } from "@/lib/artists/avatar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Carte d'Haïti — Artistes par département",
};

export default async function CartePage() {
  const supabase = await createClient();

  const { data: artists } = await supabase
    .from("artists")
    .select(
      "id, name, slug, image_url, birth_department_id, birth_commune_id, haiti_departments(code, name)",
    )
    .not("birth_department_id", "is", null)
    .eq("is_active", true)
    .limit(400);

  const rows = artists ?? [];

  // Photo manquante : récupérée depuis une plateforme rattachée à la fiche.
  const fallbacks = await resolveFallbackAvatars(
    supabase,
    rows.filter((a) => !a.image_url).map((a) => a.id as string),
  );

  const artistsByDepartment: Record<string, MapArtist[]> = {};
  for (const artist of rows) {
    const dept = artist.haiti_departments as unknown as { code: string; name: string } | null;
    if (!dept) continue;
    if (!artistsByDepartment[dept.code]) artistsByDepartment[dept.code] = [];
    artistsByDepartment[dept.code].push({
      id: artist.id as string,
      name: artist.name as string,
      slug: artist.slug as string,
      communeId: (artist.birth_commune_id as string) ?? null,
      imageUrl:
        (artist.image_url as string | null) ?? fallbacks.get(artist.id as string) ?? null,
    });
  }

  const { data: departments } = await supabase
    .from("haiti_departments")
    .select("id, name, code, haiti_communes(id, name)")
    .order("name");

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <div className="cosmos" aria-hidden="true">
        <div className="cosmos__layer cosmos__stars-distant" data-depth="0.06" />
        <div className="cosmos__layer cosmos__stars-near" data-depth="0.14" />
        <div className="cosmos__glow" />
      </div>

      <SiteHeader />
      <HaitiMapPage
        artistsByDepartment={artistsByDepartment}
        departments={departments ?? []}
      />
    </>
  );
}
