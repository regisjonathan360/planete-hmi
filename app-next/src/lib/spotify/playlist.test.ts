import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseSpotifyPlaylistId, readSpotifyPlaylist, splitEmbedArtists } from "./playlist";

const PLAYLIST_ID = "1cXIKrbi0PwJkNQgrzOokU";

function embedPage(entity: unknown): string {
  return (
    `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">` +
    JSON.stringify({ props: { pageProps: { state: { data: { entity } } } } }) +
    `</script></body></html>`
  );
}

function playlistEntity(trackCount: number) {
  return {
    type: "playlist",
    name: "Top 50 GlobHaitian",
    coverArt: { sources: [{ url: "https://img/cover.jpg" }] },
    trackList: Array.from({ length: trackCount }, (_, i) => ({
      uri: `spotify:track:${String(i).padStart(22, "A")}`,
      title: `Titre ${i + 1}`,
      subtitle: "Deejay MJ,\u00a0Eyo-E",
      audioPreview: { url: `https://p.scdn.co/mp3-preview/${i}` },
    })),
  };
}

function textResponse(body: string, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => body } as Response;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe("parseSpotifyPlaylistId", () => {
  it("accepte URL, URI et identifiant brut", () => {
    expect(parseSpotifyPlaylistId(`https://open.spotify.com/playlist/${PLAYLIST_ID}?si=xyz`)).toBe(
      PLAYLIST_ID,
    );
    expect(parseSpotifyPlaylistId(`https://open.spotify.com/fr/playlist/${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID,
    );
    expect(parseSpotifyPlaylistId(`spotify:playlist:${PLAYLIST_ID}`)).toBe(PLAYLIST_ID);
    expect(parseSpotifyPlaylistId(`  ${PLAYLIST_ID}  `)).toBe(PLAYLIST_ID);
  });

  it("refuse ce qui n'est pas une playlist", () => {
    expect(parseSpotifyPlaylistId("")).toBeNull();
    expect(parseSpotifyPlaylistId("https://open.spotify.com/track/04ySrTeBAPCjbSgn70kF1H")).toBeNull();
    expect(parseSpotifyPlaylistId("https://example.com/playlist/abc")).toBeNull();
    expect(parseSpotifyPlaylistId("trop-court")).toBeNull();
  });
});

describe("splitEmbedArtists", () => {
  it("découpe sur les virgules et normalise les espaces insécables", () => {
    expect(splitEmbedArtists("Deejay MJ,\u00a0Eyo-E,\u00a0Elge")).toEqual([
      "Deejay MJ",
      "Eyo-E",
      "Elge",
    ]);
  });

  it("gère un artiste unique et une valeur vide", () => {
    expect(splitEmbedArtists("Bedjine")).toEqual(["Bedjine"]);
    expect(splitEmbedArtists("")).toEqual([]);
  });
});

describe("readSpotifyPlaylist — page publique", () => {
  const previousId = process.env.SPOTIFY_CLIENT_ID;
  const previousSecret = process.env.SPOTIFY_CLIENT_SECRET;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Force le chemin embed : aucun identifiant API configuré.
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
  });

  afterEach(() => {
    if (previousId) process.env.SPOTIFY_CLIENT_ID = previousId;
    if (previousSecret) process.env.SPOTIFY_CLIENT_SECRET = previousSecret;
  });

  it("lit les titres et signale les métadonnées manquantes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/embed/playlist/")) return textResponse(embedPage(playlistEntity(2)));
      return jsonResponse({ thumbnail_url: "https://img/track.jpg" });
    });

    const result = await readSpotifyPlaylist(`https://open.spotify.com/playlist/${PLAYLIST_ID}`);

    expect(result.method).toBe("embed");
    expect(result.playlistName).toBe("Top 50 GlobHaitian");
    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0]).toMatchObject({
      title: "Titre 1",
      artistNames: ["Deejay MJ", "Eyo-E"],
      artworkUrl: "https://img/track.jpg",
      isrc: null,
    });
    expect(result.warnings.join(" ")).toContain("ISRC");
  });

  it("retombe sur la pochette de la playlist si oEmbed ne répond pas", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/embed/playlist/")) return textResponse(embedPage(playlistEntity(1)));
      return jsonResponse({}, 500);
    });

    const result = await readSpotifyPlaylist(PLAYLIST_ID);
    expect(result.tracks[0].artworkUrl).toBe("https://img/cover.jpg");
    expect(result.warnings.join(" ")).toContain("pochette");
  });

  it("respecte la limite demandée", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/embed/playlist/")
        ? textResponse(embedPage(playlistEntity(40)))
        : jsonResponse({ thumbnail_url: "https://img/t.jpg" }),
    );

    const result = await readSpotifyPlaylist(PLAYLIST_ID, { limit: 10 });
    expect(result.tracks).toHaveLength(10);
  });

  it("n'appelle pas oEmbed quand les pochettes ne sont pas demandées", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(textResponse(embedPage(playlistEntity(3))));

    await readSpotifyPlaylist(PLAYLIST_ID, { withArtwork: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignore les entrées sans identifiant de piste", async () => {
    const entity = playlistEntity(2);
    entity.trackList.push({
      uri: "spotify:episode:zzz",
      title: "Podcast",
      subtitle: "",
      audioPreview: { url: "" },
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/embed/playlist/")
        ? textResponse(embedPage(entity))
        : jsonResponse({ thumbnail_url: "https://img/t.jpg" }),
    );

    const result = await readSpotifyPlaylist(PLAYLIST_ID);
    expect(result.tracks).toHaveLength(2);
  });

  it("refuse un lien invalide sans appeler le réseau", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(readSpotifyPlaylist("https://example.com/x")).rejects.toThrow(
      "Lien de playlist Spotify invalide",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("message explicite si la playlist est introuvable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(textResponse("", 404));
    await expect(readSpotifyPlaylist(PLAYLIST_ID)).rejects.toThrow("Playlist introuvable");
  });

  it("message explicite si la page ne contient plus les données", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(textResponse("<html></html>"));
    await expect(readSpotifyPlaylist(PLAYLIST_ID)).rejects.toThrow("n'expose plus ses données");
  });

  it("refuse un lien qui ne pointe pas vers une playlist", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse(embedPage({ type: "album", name: "Album" })),
    );
    await expect(readSpotifyPlaylist(PLAYLIST_ID)).rejects.toThrow("ne pointe pas vers une playlist");
  });

  it("refuse une playlist vide", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      textResponse(embedPage({ type: "playlist", name: "Vide", trackList: [] })),
    );
    await expect(readSpotifyPlaylist(PLAYLIST_ID)).rejects.toThrow("aucun titre lisible");
  });
});
