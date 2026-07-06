import { requireAdmin } from "@/lib/auth/require-admin";
import { dateHaiti } from "@/lib/charts/format";
import { EditionActions } from "@/components/admin/EditionActions";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { supabase } = await requireAdmin();
  const { data: editions } = await supabase
    .from("chart_editions")
    .select("id, period_start, period_end, status, is_stale, entry_count, published_at, chart_sources(display_name)")
    .order("period_start", { ascending: false })
    .limit(100);

  return (
    <>
      <h1>Historique des éditions</h1>
      <table>
        <thead>
          <tr><th>Classement</th><th>Semaine</th><th>Entrées</th><th>Statut</th><th>Publiée</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {(editions ?? []).map((e) => {
            const src = e.chart_sources as unknown as { display_name: string } | null;
            return (
              <tr key={e.id}>
                <td>{src?.display_name ?? "—"}</td>
                <td>{dateHaiti(e.period_start)} → {dateHaiti(e.period_end)}</td>
                <td>{e.entry_count}</td>
                <td>
                  <span className={`pill ${e.status === "published" ? (e.is_stale ? "pill--warn" : "pill--ok") : "pill--warn"}`}>
                    {e.is_stale ? "périmée" : e.status}
                  </span>
                </td>
                <td>{e.published_at ? dateHaiti(e.published_at) : "—"}</td>
                <td><EditionActions editionId={e.id} status={e.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
