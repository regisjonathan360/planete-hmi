import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../AdminHeader";
import { HomepageChartManager } from "./HomepageChartManager";
import {
  computeHomepageChart,
  getPublishedHomepageChart,
} from "@/lib/home/homepage-chart";

export const dynamic = "force-dynamic";

export default async function AdminAccueilPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/accueil");

  const supabase = createAdminClient();
  const [computed, published] = await Promise.all([
    computeHomepageChart(supabase, 20).catch(() => []),
    getPublishedHomepageChart(supabase).catch(() => []),
  ]);

  return (
    <>
      <AdminHeader email={user.email} active="accueil" />
      <main className="admin__main">
        <h1 className="admin__title">Classement planétaire (page d&apos;accueil)</h1>
        <p className="admin__subtitle">
          Moyenne automatique des positions de chaque titre à travers les classements publiés
          (Audiomack, Deezer, Spotify, TikTok…). Le top 5 est affiché sur la page d&apos;accueil
          après votre validation.
        </p>
        <HomepageChartManager initialComputed={computed} initialPublished={published} />
      </main>
    </>
  );
}
