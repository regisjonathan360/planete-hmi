import {
  getHmiShortEmbedUrl,
  hmiShortPlatformLabel,
  type HmiShortPlatform,
} from "@/lib/hmi-shorts";

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

export function buildHmiShortsHtml(shorts: PublicHmiShort[]): string {
  if (shorts.length === 0) {
    return `
      <div class="hmi-shorts-empty">
        <span class="hmi-shorts-empty__signal" aria-hidden="true"></span>
        <p>La prochaine sélection de vidéos HMI arrive bientôt.</p>
      </div>
    `;
  }

  return shorts
    .map((short) => {
      const embedUrl = getHmiShortEmbedUrl(short.platform, short.external_id);
      const sourceUrl = safePublicUrl(short.source_url) ?? "#";
      const thumbnailUrl = safePublicUrl(short.thumbnail_url);
      const title = escapeHtml(short.title);
      const creator = short.creator_name ? escapeHtml(short.creator_name) : "";
      const description = short.description ? escapeHtml(short.description) : "";
      const platform = escapeHtml(hmiShortPlatformLabel(short.platform));

      const media = embedUrl
        ? `<iframe
            src="${escapeHtml(embedUrl)}"
            title="HMI Shorts — ${title}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>`
        : thumbnailUrl
          ? `<a class="hmi-short__fallback" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
              <img src="${thumbnailUrl}" alt="" loading="lazy" />
              <span>Voir la vidéo</span>
            </a>`
          : `<a class="hmi-short__fallback hmi-short__fallback--plain" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">
              <span class="hmi-short__play" aria-hidden="true">▶</span>
              <span>Voir la vidéo</span>
            </a>`;

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
    })
    .join("\n");
}
