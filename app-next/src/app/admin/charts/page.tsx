import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dateHaiti } from "@/lib/charts/format";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { redirect } = await import("next/navigation");
  redirect("/admin/login");
}

export default async function AdminDashboard() {
  const { user, supabase } = await requireAdmin();

  const { data: sources } = await supabase
    .from("chart_sources")
    .select("id, source_key, display_name, platform, ingestion_mode, is_enabled")
    .order("platform");

  const { data: editions } = await supabase
    .from("chart_editions")
    .select("id, chart_source_id, period_start, status, is_stale, entry_count, published_at")
    .order("period_start", { ascending: false });

  const { count: enAttente } = await supabase
    .from("chart_match_queue")
    .select("id", { count: "exact", head: true })
    .eq("resolution_status", "pending");

  type Edition = NonNullable<typeof editions>[number];
  const derniereParSource = new Map<string, Edition>();
  (editions ?? []).forEach((e) => {
    if (!derniereParSource.has(e.chart_source_id)) derniereParSource.set(e.chart_source_id, e);
  });

  return (
    <>
      <div className="admin__nav" style={{ border: 0, marginBottom: 0 }}>
        <h1 style={{ margin: 0 }}>Tableau de bord</h1>
        <span className="admin__spacer" />
        <span className="admin__err" style={{ color: "var(--cream-dim)" }}>{user.email}</span>
        <form action={signOut}>
          <button className="admin__btn admin__btn--ghost" type="submit">Déconnexion</button>
        </form>
      </div>

      <div className="admin__grid">
        <div className="admin__card">
          <p>Sources configurées</p>
          <p style={{ fontSize: "2rem", color: "var(--cream)" }}>{sources?.length ?? 0}</p>
        </div>
        <div className="admin__card">
          <p>Correspondances en attente</p>
          <p style={{ fontSize: "2rem", color: "var(--cream)" }}>{enAttente ?? 0}</p>
          <Link className="hmi__link" href="/admin/charts/review">Résoudre →</Link>
        </div>
        <div className="admin__card">
          <p>Nouvel import</p>
          <Link className="admin__btn" href="/admin/charts/import">Importer un classement</Link>
        </div>
      </div>

      <h2>Sources & dernière édition</h2>
      <table>
        <thead>
          <tr><th>Plateforme</th><th>Classement</th><th>Mode</th><th>Dernière édition</th><th>Statut</th></tr>
        </thead>
        <tbody>
          {(sources ?? []).map((s) => {
            const ed = derniereParSource.get(s.id);
            return (
              <tr key={s.id}>
                <td>{s.platform}</td>
                <td>{s.display_name}</td>
                <td>{s.ingestion_mode}</td>
                <td>{ed ? dateHaiti(ed.period_start) : "—"}</td>
                <td>
                  {ed ? (
                    <span className={`pill ${ed.status === "published" ? (ed.is_stale ? "pill--warn" : "pill--ok") : "pill--warn"}`}>
                      {ed.is_stale ? "périmée" : ed.status}
                    </span>
                  ) : (
                    <span className="pill pill--err">aucune</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
