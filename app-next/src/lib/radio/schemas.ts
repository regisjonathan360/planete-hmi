/**
 * Schémas TypeScript et Zod pour l'API radio
 * 
 * Ce fichier centralise tous les types et validations pour l'API radio.
 * Utilisez ces schémas pour valider les données côté client et serveur.
 */

import { z } from 'zod';

/**
 * Schéma pour un classement (chart_edition)
 */
export const ChartSchema = z.object({
  id: z.string().uuid('ID doit être un UUID valide'),
  name: z.string().min(1, 'Le nom du classement ne peut pas être vide'),
  track_count: z.number().int().min(0, 'Le nombre de chansons ne peut pas être négatif'),
  platform: z.string().min(1, 'La plateforme ne peut pas être vide'),
});

export type Chart = z.infer<typeof ChartSchema>;

/**
 * Schéma pour une source de collecte
 */
export const SourceSchema = z.object({
  id: z.string().uuid('ID doit être un UUID valide'),
  name: z.string().min(1, 'Le nom de la source ne peut pas être vide'),
  description: z.string().optional(),
  track_count: z.number().int().min(0, 'Le nombre de pistes ne peut pas être négatif'),
  type: z.enum(
    [
      'manual',
      'spotify',
      'youtube',
      'tiktok',
      'audiomack',
      'deezer',
      'soundcloud',
      'apple_music',
    ] as const
  ),
});

export type Source = z.infer<typeof SourceSchema>;

/**
 * Schéma pour la réponse complète de l'API
 */
export const AvailableSourcesResponseSchema = z.object({
  charts: z.array(ChartSchema),
  sources: z.array(SourceSchema),
});

export type AvailableSourcesResponse = z.infer<typeof AvailableSourcesResponseSchema>;

/**
 * Schéma pour les erreurs API
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'unauthorized',
      'forbidden',
      'database_error',
      'internal_error',
      'validation_error',
      'not_found',
    ]),
    message: z.string(),
    details: z.record(z.string(), z.any()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Schéma pour les paramètres de configuration radio
 */
export const RadioConfigSchema = z.object({
  active_playlist_id: z.string().uuid().nullable().optional(),
  auto_switch_to_chart: z.boolean().default(true),
  chart_source_key: z.string().nullable().optional(),
  preload_count: z.number().int().min(1).max(10).default(5),
  crossfade_duration_ms: z.number().int().min(0).max(10000).default(1000),
  is_live: z.boolean().default(false),
});

export type RadioConfig = z.infer<typeof RadioConfigSchema>;

/**
 * Helper pour valider les données de réponse
 */
export function validateAvailableSourcesResponse(data: unknown): AvailableSourcesResponse {
  return AvailableSourcesResponseSchema.parse(data);
}

/**
 * Helper pour valider une sélection de source
 */
export function validateSourceSelection(
  sourceId: string,
  availableSources: AvailableSourcesResponse
): { valid: boolean; source?: Source; error?: string } {
  // Vérifier si c'est un classement
  const chart = availableSources.charts.find((c) => c.id === sourceId);
  if (chart) {
    return {
      valid: true,
      source: {
        id: chart.id,
        name: chart.name,
        track_count: chart.track_count,
        type: (chart.platform as any) as Source['type'],
      },
    };
  }

  // Vérifier si c'est une source
  const source = availableSources.sources.find((s) => s.id === sourceId);
  if (source) {
    return { valid: true, source };
  }

  return {
    valid: false,
    error: `La source avec l'ID ${sourceId} n'existe pas`,
  };
}

/**
 * Helper pour obtenir les sources d'un type spécifique
 */
export function getSourcesByType(
  sources: AvailableSourcesResponse,
  type: Source['type']
): Source[] {
  return sources.sources.filter((s) => s.type === type);
}

/**
 * Helper pour obtenir les classements d'une plateforme spécifique
 */
export function getChartsByPlatform(
  sources: AvailableSourcesResponse,
  platform: string
): Chart[] {
  return sources.charts.filter((c) => c.platform === platform);
}

/**
 * Helper pour compter le nombre total de pistes
 */
export function getTotalTrackCount(sources: AvailableSourcesResponse): number {
  const chartsTotal = sources.charts.reduce((sum, c) => sum + c.track_count, 0);
  const sourcesTotal = sources.sources.reduce((sum, s) => sum + s.track_count, 0);
  return chartsTotal + sourcesTotal;
}

/**
 * Helper pour trier les classements par nombre de chansons
 */
export function sortChartsByTrackCount(
  charts: Chart[],
  order: 'asc' | 'desc' = 'desc'
): Chart[] {
  return [...charts].sort((a, b) => {
    const comparison = a.track_count - b.track_count;
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Helper pour trier les sources par nom
 */
export function sortSourcesByName(sources: Source[], order: 'asc' | 'desc' = 'asc'): Source[] {
  return [...sources].sort((a, b) => {
    const comparison = a.name.localeCompare(b.name);
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Helper pour grouper les sources par type
 */
export function groupSourcesByType(sources: Source[]): Record<Source['type'], Source[]> {
  const grouped: Record<Source['type'], Source[]> = {
    manual: [],
    spotify: [],
    youtube: [],
    tiktok: [],
    audiomack: [],
    deezer: [],
    soundcloud: [],
    apple_music: [],
  };

  sources.forEach((source) => {
    grouped[source.type].push(source);
  });

  return grouped;
}

/**
 * Helper pour formater les données pour affichage
 */
export function formatSourceForDisplay(source: Source): string {
  const trackCountStr = source.track_count > 0 ? ` (${source.track_count})` : '';
  return `${source.name}${trackCountStr} - ${source.type}`;
}

/**
 * Helper pour formater les données pour affichage (charts)
 */
export function formatChartForDisplay(chart: Chart): string {
  return `${chart.name} - ${chart.track_count} chansons (${chart.platform})`;
}
