import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { AngelWingsDecor, angelWingsHostClass } from "@/components/EtoilesEteintes/AngelWings";
import { artistAvatarSrc, withFallbackAvatars } from "@/lib/artists/avatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Étoiles éteintes — Planète HMI",
  description:
    "Hommage aux artistes haïtiens qui nous ont quittés. Leur héritage musical continue d'illuminer Planète HMI.",
};

interface DeceasedArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  deathDate: string | null;
}

const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Formate une date SQL (`YYYY-MM-DD`) sans décalage de fuseau. */
function formatDeathDate(raw: string | null): string | null {
  if (!raw) return null;
  const [y, m, d] = raw.slice(0, 10).split("-").map(Number);
  if (!y) return null;
  if (!m || !d) return String(y);
  return FR_DATE.format(new Date(Date.UTC(y, m - 1, d)));
}

async function getDeceasedArtists(): Promise<DeceasedArtist[]> {
  const supabase = await createClient();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, slug, image_url, death_date")
    .eq("is_active", true)
    .eq("is_deceased", true)
    .order("name", { ascending: true });

  if (!artists?.length) return [];

  const mapped: DeceasedArtist[] = artists.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    slug: a.slug as string,
    imageUrl: (a.image_url as string) ?? null,
    deathDate: (a.death_date as string) ?? null,
  }));

  // Photo manquante : on reprend celle d'une plateforme rattachée à la fiche.
  return withFallbackAvatars(supabase, mapped);
}

export default async function EtoilesEteintesPage() {
  const artists = await getDeceasedArtists();

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <div className="cosmos cosmos--artistes" aria-hidden="true">
        <div className="cosmos__layer cosmos__stars-distant" data-depth="0.06" />
        <div className="cosmos__layer cosmos__stars-near" data-depth="0.14" />
        <div className="cosmos__glow" />
      </div>

      <a className="skip-link" href="#contenu">
        Aller au contenu principal
      </a>

      <SiteHeader />

      <main id="contenu">
        <div className="wrap etoiles-page">
          <p className="breadcrumb">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire (réinitialise les animations) */}
            <a href="/">Accueil</a> /{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire */}
            <a href="/artistes">Artistes</a> / Étoiles éteintes
          </p>

          <header className={`etoiles-hero ${angelWingsHostClass}`}>
            <AngelWingsDecor idPrefix="hero-wing" />
            <div className="etoiles-hero__body">
              <h1 className="etoiles-hero__title">
                Étoiles <span className="fx-o">éteintes</span>
              </h1>
              <p className="etoiles-hero__lead">
                En mémoire des artistes qui nous ont quittés. Leur héritage musical continue
                d&apos;illuminer la planète.
              </p>
            </div>
          </header>

          {artists.length > 0 ? (
            <div className="etoiles-eteintes-grid">
              {artists.map((artist) => {
                const death = formatDeathDate(artist.deathDate);
                return (
                  <Link
                    key={artist.id}
                    href={`/artistes/${artist.slug}`}
                    className="deceased-artist-card"
                  >
                    <div className="deceased-artist-avatar">
                      {/* eslint-disable-next-line @next/next/no-img-element -- avatars distants non optimisés */}
                      <img
                        src={artistAvatarSrc(artist.imageUrl)}
                        alt={artist.name}
                        loading="lazy"
                      />
                      <div className="candle-icon" aria-hidden="true">
                        🕯️
                      </div>
                    </div>
                    <div className="deceased-artist-name">{artist.name}</div>
                    {death && (
                      <div className="deceased-artist-date">
                        <span aria-hidden="true">†</span> {death}
                      </div>
                    )}
                    <div className="deceased-artist-badge">En mémoire</div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="etoiles-empty">
              Aucun artiste n&apos;est référencé dans cette section pour le moment.
            </p>
          )}

          <p className="etoiles-back">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet volontaire */}
            <a href="/artistes">← Retour à la galaxie des artistes</a>
          </p>
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-bottom">
            <p className="footer-legal-links">
              <Link href="/privacy">Confidentialité</Link>
              <span aria-hidden="true">/</span>
              <Link href="/terms">Conditions</Link>
            </p>
            <p>Planète HMI © 2026 — Tous droits réservés</p>
          </div>
        </div>
      </footer>
    </>
  );
}
