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
    { data: groups },
    { data: parentGroups },
    { data: groupMembers },
  ] = await Promise.all([
    supabase.from("haiti_departments").select("id, name, code").order("name"),
    supabase.from("haiti_communes").select("id, department_id, name").order("name"),
    supabase.from("artists").select("id, name").eq("artist_type", "group").neq("id", id).order("name"),
    supabase.from("artist_group_members").select("group_artist_id").eq("member_artist_id", id),
    supabase.from("artist_group_members").select("member_artist_id").eq("group_artist_id", id),
  ]);

  const { data: potentialMembers } = artist.artist_type === "group"
    ? await supabase
      .from("artists")
      .select("id, name")
      .neq("id", id)
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
          groups={groups ?? []}
          potentialMembers={potentialMembers ?? []}
          initialGroupIds={(parentGroups ?? []).map((row) => row.group_artist_id as string)}
          initialMemberIds={(groupMembers ?? []).map((row) => row.member_artist_id as string)}
        />
      </main>
    </>
  );
}
