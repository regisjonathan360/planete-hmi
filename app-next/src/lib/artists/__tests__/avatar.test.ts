import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ARTIST_IMAGE_PLACEHOLDER,
  PLATFORM_AVATAR_PRIORITY,
  artistAvatarSrc,
  platformAvatarRank,
  resolveFallbackAvatars,
  withFallbackAvatars,
} from "../avatar";

type Row = Record<string, unknown>;

/**
 * Faux client Supabase minimal : renvoie les lignes préparées pour chaque table
 * interrogée, quelle que soit la chaîne de filtres appliquée.
 */
function fakeSupabase(tables: Record<string, Row[]>) {
  const calls: string[] = [];
  const builder = (rows: Row[]) => {
    const chain = {
      select: () => chain,
      in: () => chain,
      eq: () => chain,
      not: () => chain,
      then: (resolve: (value: { data: Row[] }) => unknown) => resolve({ data: rows }),
    };
    return chain;
  };

  const client = {
    from(table: string) {
      calls.push(table);
      return builder(tables[table] ?? []);
    },
  } as unknown as SupabaseClient;

  return { calls, client };
}

describe("platformAvatarRank", () => {
  it("respecte l'ordre déclaré", () => {
    expect(platformAvatarRank("spotify")).toBe(1);
    expect(platformAvatarRank("SPOTIFY")).toBe(1);
    expect(platformAvatarRank("deezer")).toBeLessThan(platformAvatarRank("tiktok"));
  });

  it("relègue les plateformes inconnues", () => {
    expect(platformAvatarRank("myspace")).toBe(50);
    expect(platformAvatarRank(null)).toBe(50);
  });

  it("couvre toutes les plateformes déclarées", () => {
    for (const platform of PLATFORM_AVATAR_PRIORITY) {
      expect(platformAvatarRank(platform)).toBeLessThan(50);
    }
  });
});

describe("artistAvatarSrc", () => {
  it("prend le premier candidat exploitable", () => {
    expect(artistAvatarSrc(null, "  https://img/a.jpg ")).toBe("https://img/a.jpg");
    expect(artistAvatarSrc("https://img/b.jpg", "https://img/a.jpg")).toBe("https://img/b.jpg");
  });

  it("retombe sur le placeholder", () => {
    expect(artistAvatarSrc(null, undefined, "   ")).toBe(ARTIST_IMAGE_PLACEHOLDER);
  });
});

describe("resolveFallbackAvatars", () => {
  it("préfère une identité vérifiée à une identité mieux classée mais non vérifiée", async () => {
    const { client } = fakeSupabase({
      artist_platform_identities: [
        {
          artist_id: "a1",
          platform: "spotify",
          platform_image_url: "https://img/spotify.jpg",
          is_verified: false,
          last_seen_at: "2026-07-01T00:00:00Z",
        },
        {
          artist_id: "a1",
          platform: "audiomack",
          platform_image_url: "https://img/audiomack.jpg",
          is_verified: true,
          last_seen_at: "2026-06-01T00:00:00Z",
        },
      ],
      youtube_channels: [],
    });

    const resolved = await resolveFallbackAvatars(client, ["a1"]);
    expect(resolved.get("a1")).toBe("https://img/audiomack.jpg");
  });

  it("classe par plateforme à niveau de vérification égal", async () => {
    const { client } = fakeSupabase({
      artist_platform_identities: [
        {
          artist_id: "a1",
          platform: "tiktok",
          platform_image_url: "https://img/tiktok.jpg",
          is_verified: false,
          last_seen_at: "2026-07-10T00:00:00Z",
        },
        {
          artist_id: "a1",
          platform: "deezer",
          platform_image_url: "https://img/deezer.jpg",
          is_verified: false,
          last_seen_at: "2026-01-01T00:00:00Z",
        },
      ],
      youtube_channels: [],
    });

    const resolved = await resolveFallbackAvatars(client, ["a1"]);
    expect(resolved.get("a1")).toBe("https://img/deezer.jpg");
  });

  it("utilise la miniature de la chaîne YouTube à défaut d'identité", async () => {
    const { client } = fakeSupabase({
      artist_platform_identities: [],
      youtube_channels: [
        {
          artist_id: "a2",
          thumbnail_url: "https://img/yt.jpg",
          is_youtube_verified: true,
          updated_at: "2026-07-01T00:00:00Z",
        },
      ],
    });

    const resolved = await resolveFallbackAvatars(client, ["a2"]);
    expect(resolved.get("a2")).toBe("https://img/yt.jpg");
  });

  it("ignore les URLs vides et les artistes sans candidat", async () => {
    const { client } = fakeSupabase({
      artist_platform_identities: [
        { artist_id: "a3", platform: "spotify", platform_image_url: "   ", is_verified: true },
      ],
      youtube_channels: [],
    });

    const resolved = await resolveFallbackAvatars(client, ["a3", "a4"]);
    expect(resolved.size).toBe(0);
  });

  it("n'interroge pas la base sans identifiant", async () => {
    const { client, calls } = fakeSupabase({});
    const resolved = await resolveFallbackAvatars(client, []);
    expect(resolved.size).toBe(0);
    expect(calls).toEqual([]);
  });
});

describe("withFallbackAvatars", () => {
  it("ne remplit que les artistes sans photo", async () => {
    const { client } = fakeSupabase({
      artist_platform_identities: [
        {
          artist_id: "a2",
          platform: "spotify",
          platform_image_url: "https://img/spotify.jpg",
          is_verified: false,
          last_seen_at: "2026-07-01T00:00:00Z",
        },
      ],
      youtube_channels: [],
    });

    const result = await withFallbackAvatars(client, [
      { id: "a1", imageUrl: "https://img/own.jpg" },
      { id: "a2", imageUrl: null },
      { id: "a3", imageUrl: null },
    ]);

    expect(result[0].imageUrl).toBe("https://img/own.jpg");
    expect(result[1].imageUrl).toBe("https://img/spotify.jpg");
    expect(result[2].imageUrl).toBeNull();
  });

  it("évite toute requête quand aucune photo ne manque", async () => {
    const { client, calls } = fakeSupabase({});
    const artists = [{ id: "a1", imageUrl: "https://img/own.jpg" }];
    expect(await withFallbackAvatars(client, artists)).toBe(artists);
    expect(calls).toEqual([]);
  });
});
