/** Schémas de validation Zod pour les données Audiomack. */
import { z } from "zod";

export const audiomackEntrySchema = z.object({
  platform: z.literal("audiomack"),
  countryCode: z.literal("HT"),
  rank: z.number().int().min(1).max(200),
  platformTrackId: z.string().nullable(),
  title: z.string().min(1),
  artistName: z.string().min(1),
  artworkUrl: z.string().url().nullable(),
  artistImageUrl: z.string().url().nullable(),
  sourceTrackUrl: z.string().min(1),
  artistSlug: z.string().nullable(),
  trackSlug: z.string().nullable(),
  albumName: z.string().nullable(),
  genre: z.string().nullable(),
});

export type ValidatedEntry = z.infer<typeof audiomackEntrySchema>;

/** Valide un tableau d'entrées. Rejette si vide ou si rangs dupliqués. */
export function validateEntries(entries: unknown[]): {
  valid: boolean;
  entries: ValidatedEntry[];
  errors: string[];
} {
  const errors: string[] = [];
  if (!entries.length) {
    errors.push("Aucun morceau dans la réponse.");
    return { valid: false, entries: [], errors };
  }

  const validated: ValidatedEntry[] = [];
  const rangs = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    const res = audiomackEntrySchema.safeParse(entries[i]);
    if (!res.success) {
      errors.push(`Entrée ${i + 1}: ${res.error.issues.map((e) => e.message).join(", ")}`);
      continue;
    }
    if (rangs.has(res.data.rank)) {
      errors.push(`Rang ${res.data.rank} dupliqué.`);
      continue;
    }
    rangs.add(res.data.rank);
    validated.push(res.data);
  }

  if (validated.length === 0) errors.push("Aucune entrée valide après validation.");
  return { valid: errors.length === 0 && validated.length > 0, entries: validated, errors };
}
