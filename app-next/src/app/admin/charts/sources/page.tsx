import { requireAdmin } from "@/lib/auth/require-admin";
import { SourceToggle } from "@/components/admin/SourceToggle";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const { supabase } = await requireAdmin();
  const { data: sources } = await supabase
    .from("chart_sources")
    .select("source_key, display_name, platform, chart_context, market_code, genre_id, ingestion_mode, is_enabled, is_automatic")
    .order("platform")
    .order("market_code")
    .order("genre_id");

  return (
    <>
      <h1>Sources de classements</h1>
      <p>Configuration des classements suivis. Activez/désactivez les sources pour contrôler ce qui apparaît sur le site public.</p>
      <table>
        <thead>
          <tr><th>Plateforme</th><th>Classement</th><th>Marché</th><th>Genre</th><th>Mode</th><th>Auto</th><th>Actif</th><th>Action</th></tr>
        </thead>
        <tbody>
          {(sources ?? []).map((s) => (
            <tr key={s.source_key}>
              <td>{s.platform}</td>
              <td><strong>{s.display_name}</strong><br /><span style={{ fontSize: "0.72rem", color: "var(--cream-dim)" }}>{s.chart_context}</span></td>
              <td>{s.market_code ?? "—"}</td>
              <td>{s.genre_id ?? "—"}</td>
              <td>{s.ingestion_mode}</td>
              <td>{s.is_automatic ? <span className="pill pill--ok">auto</span> : "manuel"}</td>
              <td>{s.is_enabled ? <span className="pill pill--ok">actif</span> : <span className="pill pill--err">off</span>}</td>
              <td><SourceToggle sourceKey={s.source_key} initialEnabled={s.is_enabled} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
