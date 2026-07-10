import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { TikTokManager } from "./TikTokManager";

export const dynamic = "force-dynamic";

export default async function TikTokAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/tiktok");

  const supabase = createAdminClient();

  // Load initial data
  // 1. Stats: total sounds, pending validation, validated, last sync run
  const [
    { count: totalSounds },
    { count: pendingSounds },
    { count: validatedSounds },
    { data: lastSyncRun },
    { data: latestEdition },
  ] = await Promise.all([
    supabase.from("tiktok_sounds").select("*", { count: "exact", head: true }),
    supabase
      .from("tiktok_sounds")
      .select("*", { count: "exact", head: true })
      .eq("validation_status", "a_verifier"),
    supabase
      .from("tiktok_sounds")
      .select("*", { count: "exact", head: true })
      .eq("validation_status", "valide"),
    supabase
      .from("sync_runs")
      .select("*")
      .eq("platform", "tiktok")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chart_editions")
      .select("*, chart_sources!inner(source_key)")
      .eq("chart_sources.source_key", "tiktok_haiti_global")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const initialData = {
    stats: {
      totalSounds: totalSounds ?? 0,
      pendingSounds: pendingSounds ?? 0,
      validatedSounds: validatedSounds ?? 0,
      lastSyncRun,
      latestEdition,
    },
  };

  return (
    <>
      <AdminHeader email={user.email} active="tiktok" />
      <main className="admin__main">
        <h1 className="admin__title">TikTok — Classements Haiti</h1>
        <p className="admin__subtitle">
          Gestion des classements TikTok : collecte, validation des sons,
          édition manuelle et publication.
        </p>
        <TikTokManager initialData={initialData} />
      </main>
    </>
  );
}
