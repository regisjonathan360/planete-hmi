import { requireAdmin } from "@/lib/auth/require-admin";

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
      <h1>Sources</h1>
      <p>Configuration des classements suivis et de leur mode d’ingestion.</p>
      <table>
        <thead>
          <tr><th>Plateforme</th><th>Classement</th><th>Marche</th><th>Genre</th><th>Contexte</th><th>Mode</th><th>Auto</th><th>Actif</th></tr>
        </thead>
        <tbody>
          {(sources ?? []).map((s) => (
            <tr key={s.source_key}>
              <td>{s.platform}</td>
              <td>{s.display_name}</td>
              <td>{s.market_code ?? "—"}</td>
              <td>{s.genre_id ?? "—"}</td>
              <td>{s.chart_context}</td>
              <td>{s.ingestion_mode}</td>
              <td>{s.is_automatic ? "oui" : "non"}</td>
              <td>{s.is_enabled ? <span className="pill pill--ok">actif</span> : <span className="pill pill--err">off</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
