import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { YOUTUBE_HMI_SOURCE_KEY } from "@/lib/youtube/constants";
import { AdminHeader } from "../AdminHeader";
import { YouTubeAdminManager } from "./YouTubeAdminManager";
import type { YouTubeAdminStats } from "./types";

export const dynamic = "force-dynamic";

export default async function YouTubeAdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/youtube");

  const supabase = createAdminClient();
  const { data: source } = await supabase
    .from("chart_sources")
    .select("id")
    .eq("source_key", YOUTUBE_HMI_SOURCE_KEY)
    .maybeSingle();

  const [
    { count: channels },
    { count: activeChannels },
    { count: pendingVideos },
    { count: eligibleVideos },
    latestEditionResult,
  ] = await Promise.all([
    supabase.from("youtube_channels").select("*", { count: "exact", head: true }),
    supabase
      .from("youtube_channels")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_active", true),
    supabase
      .from("youtube_videos")
      .select("*", { count: "exact", head: true })
      .in("review_status", ["UNREVIEWED", "NEEDS_INFORMATION"]),
    supabase
      .from("youtube_videos")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "APPROVED")
      .eq("is_eligible", true),
    source
      ? supabase
          .from("chart_editions")
          .select("id, status, period_start, period_end")
          .eq("chart_source_id", source.id)
          .order("period_end", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const latest = latestEditionResult.data;
  const initialStats: YouTubeAdminStats = {
    channels: channels ?? 0,
    activeChannels: activeChannels ?? 0,
    pendingVideos: pendingVideos ?? 0,
    eligibleVideos: eligibleVideos ?? 0,
    latestEdition: latest
      ? {
          id: latest.id as string,
          status: latest.status as string,
          periodStart: latest.period_start as string,
          periodEnd: latest.period_end as string,
        }
      : null,
  };

  return (
    <>
      <AdminHeader email={user.email} active="youtube" />
      <main className="admin__main">
        <div className="youtube-admin-heading">
          <div>
            <h1 className="admin__title">YouTube HMI</h1>
            <p className="admin__subtitle">
              Collecte, vérification éditoriale et publication du Top 20 YouTube.
            </p>
          </div>
          <a
            className="btn btn--ghost"
            href="/charts/youtube"
            target="_blank"
            rel="noreferrer"
          >
            Voir le classement public
          </a>
        </div>
        <YouTubeAdminManager initialStats={initialStats} />
      </main>
    </>
  );
}
