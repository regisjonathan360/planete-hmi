import {
  getHmiShortEmbedUrl,
  hmiShortPlatformLabel,
  type HmiShortPlatform,
} from "@/lib/hmi-shorts";

export const TIKTOK_EMBED_SCRIPT_SRC = "https://www.tiktok.com/embed.js";

export interface PublicHmiShort {
  id: string;
  platform: HmiShortPlatform;
  source_url: string;
  external_id: string | null;
  title: string;
  creator_name: string | null;
  thumbnail_url: string | null;
  description: string | null;
  display_order: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safePublicUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? escapeHtml(url.toString()) : null;
  } catch {
    return null;
  }
}

async function fetchTikTokOembed(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5_000), next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { html?: string };
    if (!data.html) return null;
    return data.html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .trim();
  } catch {
    return null;
  }
}

function buildTikTokFallback(
  sourceUrl: string,
  title: string,
  thumbnailUrl: string | null,
): string {
  return `<a class="hmi-short__fallback" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
    ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${title}" loading="lazy" />` : ""}
    <span class="hmi-short__play-overlay" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><path d="M8 5v14l11-7z"/></svg>
    </span>
    <span class="hmi-short__fallback-label">Voir sur TikTok</span>
  </a>`;
}

export async function buildHmiShortsHtml(
  shorts: PublicHmiShort[],
): Promise<{ html: string; hasTikTok: boolean }> {
  if (shorts.length === 0) {
    return {
      html: `
      <div class="hmi-shorts-empty">
        <span class="hmi-shorts-empty__signal" aria-hidden="true"></span>
        <p>La prochaine sélection de vidéos HMI arrive bientôt.</p>
      </div>
    `,
      hasTikTok: false,
    };
  }

  const tiktokShorts = shorts.filter((s) => s.platform === "tiktok");
  const oembedCache = new Map<string, string | null>();

  if (tiktokShorts.length > 0) {
    const results = await Promise.all(
      tiktokShorts.map((s) => fetchTikTokOembed(s.source_url)),
    );
    tiktokShorts.forEach((s, i) => oembedCache.set(s.source_url, results[i]));
  }

  const rows = await Promise.all(
    shorts.map(async (short) => {
      const embedUrl = getHmiShortEmbedUrl(short.platform, short.external_id);
      const sourceUrl = safePublicUrl(short.source_url) ?? "#";
      const thumbnailUrl = safePublicUrl(short.thumbnail_url);
      const title = escapeHtml(short.title);
      const creator = short.creator_name ? escapeHtml(short.creator_name) : "";
      const description = short.description ? escapeHtml(short.description) : "";
      const platform = escapeHtml(hmiShortPlatformLabel(short.platform));

      let media: string;

      if (short.platform === "tiktok") {
        const oembedHtml = oembedCache.get(short.source_url);
        if (oembedHtml) {
          media = `<div class="hmi-short__tiktok-embed">${oembedHtml}</div>`;
        } else {
          media = buildTikTokFallback(sourceUrl, title, thumbnailUrl);
        }
      } else if (embedUrl) {
        media = `<iframe
          src="${escapeHtml(embedUrl)}"
          title="HMI Shorts — ${title}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>`;
      } else if (thumbnailUrl) {
        media = `<a class="hmi-short__fallback" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${thumbnailUrl}" alt="" loading="lazy" />
          <span>Voir la vidéo</span>
        </a>`;
      } else {
        media = `<a class="hmi-short__fallback hmi-short__fallback--plain" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
          <span class="hmi-short__play" aria-hidden="true">▶</span>
          <span>Voir la vidéo</span>
        </a>`;
      }

      return `
      <article class="short hmi-short hmi-short--${short.platform}">
        <div class="hmi-short__media">${media}</div>
        <span class="hmi-short__platform">${platform}</span>
        <div class="hmi-short__caption">
          <h3>${title}</h3>
          ${creator ? `<p class="hmi-short__creator">${creator}</p>` : ""}
          ${description ? `<p class="hmi-short__description">${description}</p>` : ""}
          <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Ouvrir sur ${platform} ↗</a>
        </div>
      </article>
      `;
    }),
  );

  return { html: rows.join("\n"), hasTikTok: tiktokShorts.length > 0 };
}
