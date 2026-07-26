import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  synchronizeArtistProfiles,
  synchronizeArtistProfilePage,
} = await import("../artist-channel-sync");
const { YouTubeApiError } = await import("../api-client");
type ArtistYouTubeProfile = import("../artist-channel-sync").ArtistYouTubeProfile;
type StoredYouTubeChannel = import("../artist-channel-sync").StoredYouTubeChannel;
type ArtistChannelCandidate = import("../artist-channel-sync").ArtistChannelCandidate;
type ArtistChannelSyncStorage = import("../artist-channel-sync").ArtistChannelSyncStorage;
type YouTubeChannelInfo = import("../api-client").YouTubeChannelInfo;

const ARTIST_A = "11111111-1111-4111-8111-111111111111";
const ARTIST_B = "22222222-2222-4222-8222-222222222222";
const CHANNEL_A = "UCuAXFkgsw1L7xaCfnd5JJOw";
const CHANNEL_B = "UCaaaaaaaaaaaaaaaaaaaaaa";

function channelInfo(
  channelId = CHANNEL_A,
  title = "Chaîne officielle"
): YouTubeChannelInfo {
  return {
    channelId,
    title,
    handle: "@officielle",
    thumbnailUrl: "https://yt.example/thumb.jpg",
    subscriberCount: 100,
    videoCount: 10,
    uploadsPlaylistId: "UUuAXFkgsw1L7xaCfnd5JJOw",
  };
}

function profile(
  overrides: Partial<ArtistYouTubeProfile> = {}
): ArtistYouTubeProfile {
  return {
    id: ARTIST_A,
    name: "Artiste A",
    urlYoutube: "https://youtube.com/@artistea",
    urlYouTubeMusic: null,
    ...overrides,
  };
}

function createMemoryStorage(initial: StoredYouTubeChannel[] = []) {
  const channels = [...initial];
  const storage: ArtistChannelSyncStorage = {
    listArtistProfilesPage: vi.fn(async () => []),
    getChannelsByYouTubeIds: vi.fn(async (ids: string[]) =>
      channels.filter((channel) => ids.includes(channel.channelId))
    ),
    createCandidate: vi.fn(async (candidate: ArtistChannelCandidate) => {
      const created: StoredYouTubeChannel = {
        id: `db-${channels.length + 1}`,
        channelId: candidate.channel.channelId,
        artistId: candidate.artistId,
        channelType: "OFFICIAL_ARTIST_CHANNEL",
        status: "pending_review",
      };
      channels.push(created);
      return created;
    }),
    linkChannelToArtist: vi.fn(async (id: string, artistId: string) => {
      const channel = channels.find((entry) => entry.id === id);
      if (!channel || channel.artistId) return false;
      channel.artistId = artistId;
      return true;
    }),
  };
  return { storage, channels };
}

describe("synchronizeArtistProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée une chaîne vérifiée dans la file pending_review", async () => {
    const { storage, channels } = createMemoryStorage();
    const resolve = vi.fn(async () => channelInfo());

    const result = await synchronizeArtistProfiles(storage, [profile()], resolve);

    expect(result.created).toBe(1);
    expect(result.errors).toBe(0);
    expect(channels[0]).toMatchObject({
      channelId: CHANNEL_A,
      artistId: ARTIST_A,
      status: "pending_review",
    });
    expect(storage.createCandidate).toHaveBeenCalledOnce();
  });

  it("déduplique YouTube et YouTube Music lorsqu'ils pointent vers la même chaîne", async () => {
    const { storage } = createMemoryStorage();
    const resolve = vi.fn(async () => channelInfo());

    const result = await synchronizeArtistProfiles(storage, [
      profile({
        urlYoutube: "https://youtube.com/@artistea",
        urlYouTubeMusic: `https://music.youtube.com/channel/${CHANNEL_A}`,
      }),
    ], resolve);

    expect(result.created).toBe(1);
    expect(result.duplicateProfileUrls).toBe(1);
    expect(storage.createCandidate).toHaveBeenCalledOnce();
  });

  it("relie une chaîne artiste existante qui n'avait aucun artiste", async () => {
    const { storage, channels } = createMemoryStorage([{
      id: "db-existing",
      channelId: CHANNEL_A,
      artistId: null,
      channelType: "OFFICIAL_ARTIST_CHANNEL",
      status: "pending_review",
    }]);

    const result = await synchronizeArtistProfiles(
      storage,
      [profile()],
      async () => channelInfo()
    );

    expect(result.linkedExisting).toBe(1);
    expect(channels[0].artistId).toBe(ARTIST_A);
  });

  it("ne réattribue jamais une chaîne déjà reliée à un autre artiste", async () => {
    const { storage } = createMemoryStorage([{
      id: "db-existing",
      channelId: CHANNEL_A,
      artistId: ARTIST_B,
      channelType: "OFFICIAL_ARTIST_CHANNEL",
      status: "active",
    }]);

    const result = await synchronizeArtistProfiles(
      storage,
      [profile()],
      async () => channelInfo()
    );

    expect(result.conflicts).toBe(1);
    expect(storage.linkChannelToArtist).not.toHaveBeenCalled();
  });

  it("laisse les chaînes multi-artistes sans liaison automatique", async () => {
    const { storage } = createMemoryStorage([{
      id: "db-label",
      channelId: CHANNEL_A,
      artistId: null,
      channelType: "LABEL_CHANNEL",
      status: "active",
    }]);

    const result = await synchronizeArtistProfiles(
      storage,
      [profile()],
      async () => channelInfo()
    );

    expect(result.conflicts).toBe(1);
    expect(storage.linkChannelToArtist).not.toHaveBeenCalled();
  });

  it("continue après un lien invalide et masque les secrets dans le rapport", async () => {
    const { storage } = createMemoryStorage();
    const result = await synchronizeArtistProfiles(
      storage,
      [
        profile({ urlYoutube: "https://youtube.com/c/invalide" }),
        profile({
          id: ARTIST_B,
          name: "Artiste B",
          urlYoutube: "https://youtube.com/@artisteb",
        }),
      ],
      async (url) => {
        if (url.includes("invalide")) {
          throw new Error("Échec avec key=AIzaSy123456789012345678901234567890");
        }
        return channelInfo(CHANNEL_B, "Chaîne B");
      }
    );

    expect(result.errors).toBe(1);
    expect(result.created).toBe(1);
    expect(result.details[0].message).not.toContain("AIza");
  });

  it("interrompt le lot immédiatement si le quota YouTube est épuisé", async () => {
    const { storage } = createMemoryStorage();

    await expect(
      synchronizeArtistProfiles(
        storage,
        [profile()],
        async () => {
          throw new YouTubeApiError("Quota épuisé.", "quota_exceeded", 403);
        }
      )
    ).rejects.toMatchObject({ code: "quota_exceeded" });

    expect(storage.createCandidate).not.toHaveBeenCalled();
  });
});

describe("synchronizeArtistProfilePage", () => {
  it("retourne un curseur lorsque la page est pleine", async () => {
    const { storage } = createMemoryStorage();
    const profiles = [
      profile({ id: ARTIST_A, urlYoutube: null }),
      profile({ id: ARTIST_B, name: "Artiste B", urlYoutube: null }),
    ];
    vi.mocked(storage.listArtistProfilesPage).mockResolvedValue(profiles);

    const result = await synchronizeArtistProfilePage(
      storage,
      null,
      2,
      async () => channelInfo()
    );

    expect(result.nextCursor).toBe(ARTIST_B);
    expect(result.profilesScanned).toBe(2);
  });
});
