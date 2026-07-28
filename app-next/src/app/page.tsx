import { StaticPage } from "@/components/StaticPage";
import { SiteHeader } from "@/components/SiteHeader";
import { SOURCE_KEY_PAR_SLUG } from "@/lib/charts/format";
import { getPlatformChart } from "@/lib/charts/queries/get-platform-chart";
import { buildAudiomackTickerHtml } from "@/lib/home/audiomack-ticker";
import { getPublishedHomepageChart } from "@/lib/home/homepage-chart";
import { buildPodiumHtml } from "@/lib/home/podium-html";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tickerHtml = buildAudiomackTickerHtml([]);
  let podiumHtml = "";
  let initialUser: { email: string | null; initial: string } | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const email = user.email ?? null;
      initialUser = { email, initial: (email ?? "U").charAt(0).toUpperCase() };
    }
  } catch {
    initialUser = null;
  }

  try {
    const chart = await getPlatformChart(
      SOURCE_KEY_PAR_SLUG.audiomack,
      10
    );
    tickerHtml = buildAudiomackTickerHtml(
      (chart?.entries ?? []).map((entry) => ({
        rank: entry.filtered_position,
        title: entry.track_title,
        artistName: entry.artists_text ?? "Artiste HMI",
        rankChange: entry.movement,
        isNew: entry.entry_status?.toUpperCase() === "NEW",
      }))
    );
  } catch {
    // La page reste disponible si le classement est momentanément inaccessible.
  }

  try {
    const supabase = await createClient();
    const entries = await getPublishedHomepageChart(supabase);
    podiumHtml = buildPodiumHtml(entries);
  } catch {
    // En cas d'erreur, le podium statique de démo reste en place.
  }

  // Si le classement planétaire est publié, on remplace toute la section podium
  // du HTML statique par le vrai contenu.
  const replacements = [
    { marker: "<!-- AUDIOMACK_TICKER -->", html: tickerHtml },
  ];

  if (podiumHtml) {
    replacements.push({
      marker: "<!-- PODIUM_CONTENT -->",
      html: podiumHtml,
    });
  }

  return (
    <>
      <SiteHeader initialUser={initialUser} />
      <StaticPage
        filename="index.html"
        replacements={replacements}
        hideStaticHeader
      />
    </>
  );
}
