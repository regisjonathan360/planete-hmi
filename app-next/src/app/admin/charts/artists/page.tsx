import { requireAdmin } from "@/lib/auth/require-admin";
import { ArtistStatusButtons } from "@/components/admin/ArtistStatusButtons";
import type { HaitianStatus } from "@/lib/charts/types";

export const dynamic = "force-dynamic";

const STATUT_LABELS: Record<HaitianStatus, string> = {
  verified_haitian: "Haïtien confirmé",
  verified_haitian_diaspora: "Diaspora confirmée",
  verified_haitian_group: "Groupe confirmé",
  pending_review: "À vérifier",
  insufficient_evidence: "Preuve insuffisante",
  rejected: "Retiré",
};

function statutClass(status: HaitianStatus): string {
  if (status.startsWith("verified_")) return "pill pill--ok";
  if (status === "rejected") return "pill pill--err";
  return "pill pill--warn";
}

export default async function ArtistsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const filterStatus = params.status || "";
  const searchQuery = params.q || "";

  let query = supabase
    .from("artists")
    .select("id, name, slug, haitian_status, country_code, is_active, confidence_score, created_at")
    .order("name")
    .limit(200);

  if (filterStatus) {
    query = query.eq("haitian_status", filterStatus);
  }
  if (searchQuery) {
    query = query.ilike("name", `%${searchQuery}%`);
  }

  const { data: artists, count } = await query;

  // Compter par statut
  const { data: allArtists } = await supabase
    .from("artists")
    .select("haitian_status");
  const statsCounts: Record<string, number> = {};
  (allArtists ?? []).forEach((a) => {
    statsCounts[a.haitian_status] = (statsCounts[a.haitian_status] || 0) + 1;
  });
  const total = allArtists?.length ?? 0;

  return (
    <>
      <h1>Gestion des artistes</h1>
      <p>
        Gère le statut haïtien de tous les artistes. Les modifications affectent
        le filtrage des classements (seuls les artistes vérifiés apparaissent dans
        les positions HMI filtrées).
      </p>

      {/* Statistiques */}
      <div className="admin__grid">
        <div className="admin__card">
          <p>Total artistes</p>
          <p style={{ fontSize: "2rem", color: "var(--cream)" }}>{total}</p>
        </div>
        <div className="admin__card">
          <p>Vérifiés</p>
          <p style={{ fontSize: "2rem", color: "var(--up)" }}>
            {(statsCounts.verified_haitian || 0) + (statsCounts.verified_haitian_diaspora || 0) + (statsCounts.verified_haitian_group || 0)}
          </p>
        </div>
        <div className="admin__card">
          <p>À vérifier</p>
          <p style={{ fontSize: "2rem", color: "var(--gold)" }}>{statsCounts.pending_review || 0}</p>
        </div>
        <div className="admin__card">
          <p>Retirés</p>
          <p style={{ fontSize: "2rem", color: "var(--down)" }}>{statsCounts.rejected || 0}</p>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1.5rem 0" }}>
        <form method="get" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input name="q" defaultValue={searchQuery} placeholder="Rechercher un artiste..." style={{ minWidth: 200 }} />
          <select name="status" defaultValue={filterStatus}>
            <option value="">Tous les statuts</option>
            <option value="verified_haitian">Haïtien confirmé</option>
            <option value="verified_haitian_diaspora">Diaspora confirmée</option>
            <option value="verified_haitian_group">Groupe confirmé</option>
            <option value="pending_review">À vérifier</option>
            <option value="insufficient_evidence">Preuve insuffisante</option>
            <option value="rejected">Retiré</option>
          </select>
          <button className="admin__btn" type="submit">Filtrer</button>
        </form>
      </div>

      {/* Tableau */}
      {(!artists || artists.length === 0) ? (
        <p className="admin__err">Aucun artiste trouvé avec ces filtres.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Artiste</th>
              <th>Statut</th>
              <th>Pays</th>
              <th>Score</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong><br /><span style={{ fontSize: "0.75rem", color: "var(--cream-dim)" }}>{a.slug}</span></td>
                <td><span className={statutClass(a.haitian_status as HaitianStatus)}>{STATUT_LABELS[a.haitian_status as HaitianStatus] ?? a.haitian_status}</span></td>
                <td>{a.country_code ?? "—"}</td>
                <td>{a.confidence_score ?? "—"}</td>
                <td>{a.is_active ? <span className="pill pill--ok">oui</span> : <span className="pill pill--err">non</span>}</td>
                <td><ArtistStatusButtons artistId={a.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ color: "var(--cream-dim)", marginTop: "1rem", fontSize: "0.85rem" }}>
        Affichage limité à 200 résultats. Utilisez la recherche pour affiner.
      </p>
    </>
  );
}
