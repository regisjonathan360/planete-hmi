import { requireAdmin } from "@/lib/auth/require-admin";
import { ArtistStatusButtons } from "@/components/admin/ArtistStatusButtons";
import type { HaitianStatus } from "@/lib/charts/types";

export const dynamic = "force-dynamic";

const STATUT_LABELS: Record<HaitianStatus, string> = {
  verified_haitian: "haitien confirme",
  verified_haitian_diaspora: "diaspora confirmee",
  verified_haitian_group: "groupe confirme",
  pending_review: "a verifier",
  insufficient_evidence: "preuve insuffisante",
  rejected: "retire",
};

function statutClass(status: HaitianStatus): string {
  if (status.startsWith("verified_")) return "pill pill--ok";
  if (status === "rejected") return "pill pill--err";
  return "pill pill--warn";
}

interface ArtistRow {
  id: string;
  name: string;
  status: HaitianStatus;
  countryCode: string | null;
  appearances: string[];
}

export default async function AudiomackArtistReviewPage() {
  const { supabase } = await requireAdmin();

  const { data: sources } = await supabase
    .from("chart_sources")
    .select("id")
    .eq("platform", "audiomack");
  const sourceIds = (sources ?? []).map((source) => source.id);

  const { data: editions } = sourceIds.length
    ? await supabase
        .from("chart_editions")
        .select("id")
        .in("chart_source_id", sourceIds)
        .order("period_start", { ascending: false })
        .limit(20)
    : { data: [] };
  const editionIds = (editions ?? []).map((edition) => edition.id);

  const { data: entries } = editionIds.length
    ? await supabase
        .from("chart_entries")
        .select("track_id, raw_track_title, raw_artist_text, source_position, filtered_position, chart_edition_id")
        .in("chart_edition_id", editionIds)
        .order("source_position")
    : { data: [] };

  const trackIds = [
    ...new Set((entries ?? []).map((entry) => entry.track_id).filter((trackId): trackId is string => !!trackId)),
  ];

  const artists = new Map<string, ArtistRow>();
  if (trackIds.length) {
    const { data: credits } = await supabase
      .from("track_artists")
      .select("track_id, role, billing_order, artists(id, name, haitian_status, country_code)")
      .in("track_id", trackIds)
      .in("role", ["primary", "co_primary"]);

    for (const credit of credits ?? []) {
      const relatedArtists = credit.artists as unknown;
      const artist = (Array.isArray(relatedArtists) ? relatedArtists[0] : relatedArtists) as {
        id: string;
        name: string;
        haitian_status: HaitianStatus;
        country_code: string | null;
      } | null;
      if (!artist) continue;

      const entry = (entries ?? []).find((candidate) => candidate.track_id === credit.track_id);
      const current = artists.get(artist.id) ?? {
        id: artist.id,
        name: artist.name,
        status: artist.haitian_status,
        countryCode: artist.country_code,
        appearances: [],
      };

      if (entry && current.appearances.length < 4) {
        current.appearances.push(`#${entry.source_position} ${entry.raw_track_title ?? "Titre inconnu"}`);
      }
      artists.set(artist.id, current);
    }
  }

  const rows = [...artists.values()].sort((a, b) => {
    const statusOrder = a.status.localeCompare(b.status);
    return statusOrder || a.name.localeCompare(b.name);
  });

  return (
    <>
      <h1>Artistes Audiomack</h1>
      <p>
        Decide ici quels artistes restent dans les classements haitiens.
        Les positions Audiomack source restent intactes; seules les positions HMI
        filtrees sont recalculees.
      </p>

      {rows.length === 0 ? (
        <p className="admin__err">Aucun artiste Audiomack trouve dans les editions importees.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Artiste</th>
              <th>Statut</th>
              <th>Dernieres entrees Audiomack</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((artist) => (
              <tr key={artist.id}>
                <td>
                  <strong>{artist.name}</strong>
                  <br />
                  <span className="admin__muted">{artist.countryCode ?? "pays non renseigne"}</span>
                </td>
                <td><span className={statutClass(artist.status)}>{STATUT_LABELS[artist.status]}</span></td>
                <td>{artist.appearances.length ? artist.appearances.join(" | ") : "Aucune entree recente"}</td>
                <td><ArtistStatusButtons artistId={artist.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
