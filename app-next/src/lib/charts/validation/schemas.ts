/**
 * Schémas de validation (Zod) pour les entrées d'import et l'environnement.
 * Une entrée d'import est rejetée si elle ne contient pas au minimum
 * source_position, track_title, artist_names, source_period et un
 * source_identifier OU source_url.
 */
import { z } from "zod";

export const importRowSchema = z
  .object({
    source_position: z.coerce.number().int().min(1),
    track_title: z.string().min(1),
    artist_names: z.string().min(1),
    source_period_start: z.string().min(1),
    source_period_end: z.string().min(1),
    source_identifier: z.string().optional(),
    source_url: z.string().url().optional(),
    isrc: z.string().optional(),
    artwork_url: z.string().url().optional(),
    metric_value: z.coerce.number().optional(),
    metric_unit: z.string().optional(),
    source_updated_at: z.string().optional(),
  })
  .refine((r) => !!(r.source_identifier || r.source_url), {
    message: "source_identifier ou source_url est requis.",
    path: ["source_identifier"],
  });

export type ImportRow = z.infer<typeof importRowSchema>;

export const importPayloadSchema = z.object({
  platform: z.enum(["youtube", "spotify", "audiomack", "apple_music", "tiktok"]),
  source_key: z.string().min(1),
  rows: z.array(importRowSchema).min(1),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;

/** Variables d'environnement serveur requises côté application. */
export const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

/** Valide un lot de lignes d'import et sépare valides / invalides. */
export function validerLignesImport(rows: unknown[]): {
  valides: ImportRow[];
  invalides: { index: number; erreurs: string[] }[];
} {
  const valides: ImportRow[] = [];
  const invalides: { index: number; erreurs: string[] }[] = [];
  rows.forEach((row, index) => {
    const res = importRowSchema.safeParse(row);
    if (res.success) valides.push(res.data);
    else invalides.push({ index, erreurs: res.error.issues.map((i) => i.message) });
  });
  return { valides, invalides };
}
