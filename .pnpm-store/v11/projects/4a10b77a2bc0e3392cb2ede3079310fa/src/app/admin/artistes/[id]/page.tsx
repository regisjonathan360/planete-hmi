import { redirect, notFound } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../../AdminHeader";
import { ArtistEditForm } from "./ArtistEditForm";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function AdminArtistEditPage({ params }: Props) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!artist) notFound();

  const [
    { data: departments },
    { data: communes },
    { data: parentGroups },
    { data: groupMembers },
  ] = await Promise.all([
    supabase.from("haiti_departments").select("id, name, code").order("name"),
    supabase.from("haiti_communes").select("id, department_id, name").order("name"),
    supabase.from("artist_group_members").select("group_artist_id").eq("member_artist_id", id),
    supabase.from("artist_group_members").select("member_artist_id").eq("group_artist_id", id),
  ]);

  const initialGroupIds = (parentGroups ?? []).map((row) => row.group_artist_id as string);
  const initialMemberIds = (groupMembers ?? []).map((row) => row.member_artist_id as string);
  const relatedIds = [...new Set([...initialGroupIds, ...initialMemberIds])];
  const { data: relatedArtists } = relatedIds.length > 0
    ? await supabase
      .from("artists")
      .select("id, name, artist_type")
      .in("id", relatedIds)
      .order("name")
    : { data: [] };

  return (
    <>
      <AdminHeader email={user.email} active="artistes" />
      <main className="admin__main">
        <ArtistEditForm
          artist={artist}
          departments={departments ?? []}
          communes={communes ?? []}
          initialGroups={(relatedArtists ?? []).filter((item) => initialGroupIds.includes(item.id as string))}
          initialMembers={(relatedArtists ?? []).filter((item) => initialMemberIds.includes(item.id as string))}
          initialGroupIds={initialGroupIds}
          initialMemberIds={initialMemberIds}
        />
      </main>
    </>
  );
}
