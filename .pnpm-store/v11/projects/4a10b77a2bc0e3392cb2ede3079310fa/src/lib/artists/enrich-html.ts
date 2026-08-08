export interface ExtractedImage {
  url: string;
  label: string;
  type: "avatar" | "banner" | "cover";
}

export interface ExtractedPageMetadata {
  name: string | null;
  description: string | null;
  images: ExtractedImage[];
  details: Record<string, string | string[]>;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .trim();
}

function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function resolveUrl(value: string, pageUrl: string): string | null {
  try {
    const resolved = new URL(value, pageUrl);
    return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.toString() : null;
  } catch {
    return null;
  }
}

function valuesFromJsonLd(value: unknown): {
  names: string[];
  descriptions: string[];
  images: string[];
  sameAs: string[];
} {
  const result = { names: [] as string[], descriptions: [] as string[], images: [] as string[], sameAs: [] as string[] };
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.name === "string") result.names.push(record.name);
    if (typeof record.description === "string") result.descriptions.push(record.description);
    for (const key of ["image", "logo", "thumbnailUrl"]) {
      const image = record[key];
      if (typeof image === "string") result.images.push(image);
      else if (Array.isArray(image)) image.filter((item): item is string => typeof item === "string").forEach((item) => result.images.push(item));
      else if (image && typeof image === "object" && typeof (image as Record<string, unknown>).url === "string") {
        result.images.push((image as Record<string, unknown>).url as string);
      }
    }
    if (typeof record.sameAs === "string") result.sameAs.push(record.sameAs);
    else if (Array.isArray(record.sameAs)) {
      record.sameAs.filter((item): item is string => typeof item === "string").forEach((item) => result.sameAs.push(item));
    }
    if (record["@graph"]) visit(record["@graph"]);
  };
  visit(value);
  return result;
}

export function extractPageMetadata(html: string, pageUrl: string, platformLabel: string): ExtractedPageMetadata {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = readAttributes(tag);
    const key = (attributes.property ?? attributes.name ?? attributes.itemprop ?? "").toLowerCase();
    if (key && attributes.content && !meta.has(key)) meta.set(key, attributes.content);
  }

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const jsonLd = { names: [] as string[], descriptions: [] as string[], images: [] as string[], sameAs: [] as string[] };
  const jsonLdPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch: RegExpExecArray | null;
  while ((jsonMatch = jsonLdPattern.exec(html))) {
    try {
      const values = valuesFromJsonLd(JSON.parse(jsonMatch[1]));
      jsonLd.names.push(...values.names);
      jsonLd.descriptions.push(...values.descriptions);
      jsonLd.images.push(...values.images);
      jsonLd.sameAs.push(...values.sameAs);
    } catch {
      // Une balise JSON-LD invalide ne doit pas annuler les autres métadonnées.
    }
  }

  const imageCandidates: Array<{ value: string | undefined; label: string; type: ExtractedImage["type"] }> = [
    { value: meta.get("og:image"), label: `Image ${platformLabel}`, type: "cover" },
    { value: meta.get("og:image:url"), label: `Image ${platformLabel}`, type: "cover" },
    { value: meta.get("twitter:image"), label: `Image ${platformLabel} (X Card)`, type: "cover" },
    { value: meta.get("twitter:image:src"), label: `Image ${platformLabel} (X Card)`, type: "cover" },
    ...jsonLd.images.map((value) => ({ value, label: `Image ${platformLabel} (profil)`, type: "avatar" as const })),
  ];

  const seen = new Set<string>();
  const images: ExtractedImage[] = [];
  for (const candidate of imageCandidates) {
    if (!candidate.value) continue;
    const url = resolveUrl(candidate.value, pageUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push({ url, label: candidate.label, type: candidate.type });
  }

  const sameAs = jsonLd.sameAs
    .map((value) => resolveUrl(value, pageUrl))
    .filter((value): value is string => Boolean(value));

  return {
    name: decodeHtml(meta.get("og:title") ?? meta.get("twitter:title") ?? jsonLd.names[0] ?? titleMatch?.[1] ?? "") || null,
    description: decodeHtml(meta.get("og:description") ?? meta.get("description") ?? jsonLd.descriptions[0] ?? "") || null,
    images,
    details: sameAs.length ? { related_urls: [...new Set(sameAs)] } : {},
  };
}

export function mergeImages(...groups: ExtractedImage[][]): ExtractedImage[] {
  const seen = new Set<string>();
  return groups.flat().filter((image) => {
    if (!image.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  });
}
