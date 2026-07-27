import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { HaitiMapPage } from "./HaitiMapPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Carte d'Haïti — Artistes par département",
};

export default async function CartePage() {
  const supabase = await createClient();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, slug, image_url, birth_department_id, haiti_departments(code, name)")
    .not("birth_department_id", "is", null)
    .eq("is_active", true)
    .limit(200);

  const artistsByDepartment: Record<string, Array<{ id: string; name: string; image_url: string | null }>> = {};
  for (const artist of artists ?? []) {
    const dept = artist.haiti_departments as unknown as { code: string; name: string } | null;
    if (!dept) continue;
    if (!artistsByDepartment[dept.code]) artistsByDepartment[dept.code] = [];
    artistsByDepartment[dept.code].push({
      id: artist.id as string,
      name: artist.name as string,
      image_url: artist.image_url as string | null,
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
