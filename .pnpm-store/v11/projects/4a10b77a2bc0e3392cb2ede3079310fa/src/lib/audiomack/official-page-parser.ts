import type { AudiomackRawTrack } from "./types";

const PUSH_PREFIX = "self.__next_f.push(";

function htmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function findClosingParen(text: string, start: number): number {
  let depth = 1;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out));
    return out;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, out));
  }
  return out;
}

function extractFlightText(html: string): string {
  const chunks: string[] = [];
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const callStart = html.indexOf(PUSH_PREFIX, searchFrom);
    if (callStart === -1) break;

    const argsStart = callStart + PUSH_PREFIX.length;
    const argsEnd = findClosingParen(html, argsStart);
    if (argsEnd === -1) break;

    const args = html.slice(argsStart, argsEnd);
    try {
      collectStrings(JSON.parse(args), chunks);
    } catch {
      // Ignore malformed chunks; the page has many unrelated scripts.
    }
    searchFrom = argsEnd + 1;
  }

  return chunks.join("");
}

function readBalancedJson(text: string, start: number): string | null {
  const opener = text[start];
  if (opener !== "[" && opener !== "{") return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "[" || char === "{") {
      stack.push(char === "[" ? "]" : "}");
    } else if (char === "]" || char === "}") {
      const expected = stack.pop();
      if (expected !== char) return null;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function isRawTrack(value: unknown): value is AudiomackRawTrack {
  if (!value || typeof value !== "object") return false;
  const row = value as { title?: unknown; artist?: unknown; type?: unknown };
  return typeof row.title === "string" && typeof row.artist === "string" && (row.type == null || row.type === "song");
}

function extractTrackArrays(text: string): AudiomackRawTrack[][] {
  const arrays: AudiomackRawTrack[][] = [];
  const key = '"tracks":';
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const keyIndex = text.indexOf(key, searchFrom);
    if (keyIndex === -1) break;

    const valueStart = keyIndex + key.length;
    const json = readBalancedJson(text, valueStart);
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.every(isRawTrack)) {
          arrays.push(parsed);
        }
      } catch {
        // Continue looking; other "tracks" references are React Flight pointers.
      }
    }
    searchFrom = valueStart + 1;
  }

  return arrays;
}

export function extractAudiomackTracksFromHtml(html: string): AudiomackRawTrack[] {
  // Format 1 : page /charts?country=haiti (HTML classique avec ChartCard)
  const chartCardTracks = extractFromChartsPage(html);
  if (chartCardTracks.length > 0) return chartCardTracks;

  // Format 2 : page /geo-charts/playlist/haiti (React Flight / self.__next_f.push)
  const flightText = extractFlightText(html);
  const candidates = extractTrackArrays(flightText).sort((a, b) => b.length - a.length);
  return candidates[0] ?? [];
}

/** Extraction depuis la page /charts (HTML avec ChartCard, MusicCard-artist, MusicCard-title) */
function extractFromChartsPage(html: string): AudiomackRawTrack[] {
  const tracks: AudiomackRawTrack[] = [];
  // Pattern: <div class="ChartRank"...>N.</div>...<MusicCard-artist-link>ARTIST</a>...<MusicCard-title-link>TITLE</a>...<img src="ARTWORK"/>
  const cardPattern = /<div[^>]*class="ChartCard"[^>]*>([\s\S]*?)<\/article>/gi;
  let cardMatch;

  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const card = cardMatch[1];

    // Rang
    const rankMatch = card.match(/<div[^>]*class="ChartRank"[^>]*>\s*(\d+)\./);
    const rank = rankMatch ? parseInt(rankMatch[1], 10) : tracks.length + 1;

    // Titre (aria-label="Listen to TITLE")
    const titleMatch = card.match(/aria-label="Listen to ([^"]+)"/);
    const title = titleMatch ? htmlDecode(titleMatch[1]) : null;

    // Artiste (MusicCard-artist-link ou data-testid="MusicCard-artist")
    const artistMatch = card.match(/data-testid="MusicCard-artist"[^>]*>([^<]+)</);
    const artist = artistMatch ? htmlDecode(artistMatch[1].trim()) : null;

    // Artwork (img src dans CardImage)
    const artworkMatch = card.match(/class="Img CardImage"[^>]*src="([^"]+)"/);
    const artwork = artworkMatch ? artworkMatch[1] : null;

    // URL slug (href du lien titre)
    const hrefMatch = card.match(/data-testid="MusicCard-title"[^>]*href="([^"]+)"/);
    const urlSlug = hrefMatch ? hrefMatch[1] : null;

    if (title && artist) {
      tracks.push({
        title,
        artist,
        id: urlSlug ?? `chart-${rank}`,
        image: artwork ?? undefined,
        url_slug: urlSlug ?? undefined,
        type: "song",
      });
    }
  }

  return tracks;
}

export function extractAudiomackMetaSongTitles(html: string): string[] {
  return [...html.matchAll(/<meta\s+property=["']music:song["']\s+content=["']([^"']*)["']/gi)]
    .map((match) => htmlDecode(match[1]).trim())
    .filter(Boolean);
}

export function extractAudiomackSourceUpdatedAt(html: string): string | null {
  const match = html.match(
    /<span[^>]*>\s*Last updated:\s*<\/span>\s*<span[^>]*>\s*([^<]+?)\s*<\/span>/i
  );
  if (!match) return null;

  const parsed = Date.parse(`${htmlDecode(match[1].trim())} 00:00:00 UTC`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
