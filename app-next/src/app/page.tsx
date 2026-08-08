import { StaticPage } from "@/components/StaticPage";
import { SiteHeader } from "@/components/SiteHeader";
import { SOURCE_KEY_PAR_SLUG } from "@/lib/charts/format";
import { getPlatformChart } from "@/lib/charts/queries/get-platform-chart";
import { buildAudiomackTickerHtml } from "@/lib/home/audiomack-ticker";
import {
  buildHmiShortsHtml,
  type PublicHmiShort,
} from "@/lib/home/hmi-shorts-html";
import { getPublishedHomepageChart } from "@/lib/home/homepage-chart";
import { buildPodiumHtml } from "@/lib/home/podium-html";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadInitialUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const email = user.email ?? null;
      return { email, initial: (email ?? "U").charAt(0).toUpperCase() };
    }
  } catch {
    // L’en-tête reste en état déconnecté si la session est inaccessible.
  }
  return null;
}

async function loadShortsHtml() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("hmi_shorts")
      .select(
        "id, platform, source_url, external_id, title, creator_name, thumbnail_url, description, display_order",
      )
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(12);
    if (!error) {
      return buildHmiShortsHtml((data ?? []) as PublicHmiShort[]);
    }
  } catch {
    // La page reste disponible si la sélection HMI Shorts est inaccessible.
  }
  return buildHmiShortsHtml([]);
}

async function loadTickerHtml() {
  try {
    const chart = await getPlatformChart(
      SOURCE_KEY_PAR_SLUG.audiomack,
      10
    );
    return buildAudiomackTickerHtml(
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
  return buildAudiomackTickerHtml([]);
}

async function loadPodiumHtml() {
  try {
    const supabase = await createClient();
    const entries = await getPublishedHomepageChart(supabase);
    return buildPodiumHtml(entries);
  } catch {
    // En cas d'erreur, le podium statique de démo reste en place.
  }
  return "";
}

export default async function HomePage() {
  const [initialUser, shortsHtml, tickerHtml, podiumHtml] = await Promise.all([
    loadInitialUser(),
    loadShortsHtml(),
    loadTickerHtml(),
    loadPodiumHtml(),
  ]);

  // Si le classement planétaire est publié, on remplace toute la section podium
  // du HTML statique par le vrai contenu.
  const replacements = [
    { marker: "<!-- AUDIOMACK_TICKER -->", html: tickerHtml },
    { marker: "<!-- HMI_SHORTS_CONTENT -->", html: shortsHtml },
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
