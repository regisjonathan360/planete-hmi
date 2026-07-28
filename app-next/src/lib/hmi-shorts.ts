import { z } from "zod";

export const hmiShortPlatformSchema = z.enum(["tiktok", "instagram", "youtube"]);
export type HmiShortPlatform = z.infer<typeof hmiShortPlatformSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const createHmiShortSchema = z.object({
  url: z.string().trim().url("L’URL de la vidéo est invalide.").max(500),
  title: z.string().trim().max(160).optional().default(""),
  creatorName: optionalText(120),
  description: optionalText(500),
  displayOrder: z.coerce.number().int().min(1).max(100).default(1),
  isPublished: z.boolean().default(false),
});

export const updateHmiShortSchema = createHmiShortSchema
  .omit({ url: true })
  .partial()
  .extend({
    title: z.string().trim().min(1, "Le titre est requis.").max(160).optional(),
    isPublished: z.boolean().optional(),
    displayOrder: z.coerce.number().int().min(1).max(100).optional(),
  });

export interface ParsedHmiShortUrl {
  platform: HmiShortPlatform;
  canonicalUrl: string;
  externalId: string | null;
  embedUrl: string | null;
}

function cleanId(value: string | null): string | null {
  if (!value) return null;
  const id = value.trim();
  return /^[A-Za-z0-9_-]{5,80}$/.test(id) ? id : null;
}

export function parseHmiShortUrl(input: string): ParsedHmiShortUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("L’URL de la vidéo est invalide.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Utilisez une URL sécurisée commençant par https://.");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be"
  ) {
    const id =
      host === "youtu.be"
        ? cleanId(segments[0] ?? null)
        : segments[0] === "shorts"
          ? cleanId(segments[1] ?? null)
          : cleanId(url.searchParams.get("v"));
    if (!id) {
      throw new Error("Cette URL YouTube ne contient pas d’identifiant vidéo valide.");
    }
    return {
      platform: "youtube",
      canonicalUrl: `https://www.youtube.com/shorts/${id}`,
      externalId: id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (
    host === "tiktok.com" ||
    host === "m.tiktok.com" ||
    host === "vm.tiktok.com" ||
    host === "vt.tiktok.com"
  ) {
    const videoIndex = segments.indexOf("video");
    const id = videoIndex >= 0 ? cleanId(segments[videoIndex + 1] ?? null) : null;
    return {
      platform: "tiktok",
      canonicalUrl: id
        ? `https://www.tiktok.com/@${segments[0]?.replace(/^@/, "") || "video"}/video/${id}`
        : url.toString(),
      externalId: id,
      embedUrl: id ? `https://www.tiktok.com/player/v1/${id}` : null,
    };
  }

  if (host === "instagram.com" || host === "m.instagram.com") {
    const kind = segments[0];
    const id =
      kind === "reel" || kind === "reels" || kind === "p"
        ? cleanId(segments[1] ?? null)
        : null;
    if (!id) {
      throw new Error("Utilisez l’URL complète d’un Reel ou d’une publication Instagram.");
    }
    return {
      platform: "instagram",
      canonicalUrl: `https://www.instagram.com/reel/${id}/`,
      externalId: id,
      embedUrl: `https://www.instagram.com/reel/${id}/embed/`,
    };
  }

  throw new Error("Plateforme non prise en charge. Utilisez TikTok, Instagram ou YouTube.");
}

interface OEmbedMetadata {
  title: string | null;
  creatorName: string | null;
  thumbnailUrl: string | null;
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchHmiShortMetadata(
  parsed: ParsedHmiShortUrl,
): Promise<OEmbedMetadata> {
  const endpoint =
    parsed.platform === "youtube"
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.canonicalUrl)}`
      : parsed.platform === "tiktok"
        ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}`
        : null;

  if (!endpoint) {
    return { title: null, creatorName: null, thumbnailUrl: null };
  }

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(7_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { title: null, creatorName: null, thumbnailUrl: null };
    }
    const data = (await response.json()) as Record<string, unknown>;
    return {
      title: typeof data.title === "string" ? data.title.slice(0, 160) : null,
      creatorName:
        typeof data.author_name === "string" ? data.author_name.slice(0, 120) : null,
      thumbnailUrl: safeHttpsUrl(data.thumbnail_url),
    };
  } catch {
    return { title: null, creatorName: null, thumbnailUrl: null };
  }
}

export function getHmiShortEmbedUrl(
  platform: HmiShortPlatform,
  externalId: string | null,
): string | null {
  if (!externalId) return null;
  if (platform === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${externalId}`;
  }
  if (platform === "tiktok") {
    return `https://www.tiktok.com/player/v1/${externalId}`;
  }
  return `https://www.instagram.com/reel/${externalId}/embed/`;
}

export function hmiShortPlatformLabel(platform: HmiShortPlatform): string {
  if (platform === "youtube") return "YouTube Shorts";
  if (platform === "instagram") return "Instagram Reels";
  return "TikTok";
}
