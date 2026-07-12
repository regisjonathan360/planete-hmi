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

  return (
    <>
      <AdminHeader email={user.email} active="artistes" />
      <main className="admin__main">
        <ArtistEditForm artist={artist} />
      </main>
    </>
  );
}
