import { describe, expect, it } from "vitest";
import {
  getPaginationItems,
  matchesArtistFilter,
  type ArtistAdminRecord,
} from "./ArtistList";

const COMPLETE_ARTIST: ArtistAdminRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Artiste Test",
  slug: "artiste-test",
  image_url: "https://example.com/avatar.jpg",
  banner_url: "https://example.com/banner.jpg",
  bio: "Biographie",
  haitian_status: "verified_haitian",
  is_active: true,
  is_claimed: true,
  artist_type: "singer",
  tags: ["chanteur"],
  primary_genre: "Konpa",
  city: "Port-au-Prince",
  birth_place: "Cap-Haïtien",
  birth_date: "1990-01-01",
  url_youtube: "https://youtube.com/@artiste",
  url_youtube_music: null,
  url_deezer: "https://deezer.com/artist/1",
  url_spotify: "https://open.spotify.com/artist/1",
  url_audiomack: "https://audiomack.com/artiste",
  url_apple_music: "https://music.apple.com/artist/1",
  url_soundcloud: "https://soundcloud.com/artiste",
  url_tidal: "https://tidal.com/artist/1",
  url_tiktok: "https://tiktok.com/@artiste",
  url_instagram: "https://instagram.com/artiste",
  url_facebook: "https://facebook.com/artiste",
  url_twitter: "https://x.com/artiste",
  url_threads: "https://threads.net/@artiste",
  url_website: "https://example.com",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("filtres administratifs des artistes", () => {
  it("distingue les profils revendiqués", () => {
    expect(matchesArtistFilter(COMPLETE_ARTIST, "claimed")).toBe(true);
    expect(matchesArtistFilter({ ...COMPLETE_ARTIST, is_claimed: false }, "unclaimed")).toBe(true);
  });

  it("considère la fiche essentielle complète", () => {
    expect(matchesArtistFilter(COMPLETE_ARTIST, "complete")).toBe(true);
    expect(matchesArtistFilter(COMPLETE_ARTIST, "incomplete")).toBe(false);
  });

  it("détecte chaque information essentielle manquante", () => {
    expect(matchesArtistFilter({ ...COMPLETE_ARTIST, birth_place: null }, "missing_birth_place")).toBe(true);
    expect(matchesArtistFilter({ ...COMPLETE_ARTIST, birth_date: null }, "missing_birth_date")).toBe(true);
    expect(matchesArtistFilter({ ...COMPLETE_ARTIST, tags: [] }, "missing_roles")).toBe(true);
  });

  it("accepte YouTube ou YouTube Music comme lien YouTube", () => {
    expect(matchesArtistFilter(COMPLETE_ARTIST, "missing_youtube")).toBe(false);
    expect(matchesArtistFilter({
      ...COMPLETE_ARTIST,
      url_youtube: null,
      url_youtube_music: "https://music.youtube.com/channel/test",
    }, "missing_youtube")).toBe(false);
    expect(matchesArtistFilter({
      ...COMPLETE_ARTIST,
      url_youtube: null,
      url_youtube_music: null,
    }, "missing_youtube")).toBe(true);
  });

  it("détecte les profils à vérifier et masqués", () => {
    const artist = {
      ...COMPLETE_ARTIST,
      haitian_status: "pending_review",
      is_active: false,
    };
    expect(matchesArtistFilter(artist, "pending_review")).toBe(true);
    expect(matchesArtistFilter(artist, "hidden")).toBe(true);
  });
});

describe("pagination administrative des artistes", () => {
  it("affiche toutes les pages lorsque la liste est courte", () => {
    expect(getPaginationItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("conserve la premiÃ¨re, la derniÃ¨re et les pages proches", () => {
    expect(getPaginationItems(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
  });

  it("ne produit pas de page hors limites aux extrÃ©mitÃ©s", () => {
    expect(getPaginationItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(getPaginationItems(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});
