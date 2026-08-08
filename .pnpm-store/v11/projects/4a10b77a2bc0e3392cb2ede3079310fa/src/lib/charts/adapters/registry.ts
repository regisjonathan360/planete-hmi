/**
 * Registre d'adaptateurs + exécution isolée.
 * Enveloppe chaque appel d'adaptateur pour qu'une erreur soit capturée
 * (et non propagée) : la panne d'une plateforme n'interrompt jamais les autres.
 */
import { PlatformName } from "../types";
import {
  ChartFetchContext,
  ChartSourceAdapter,
  RawChartResult,
} from "./types";

const registre = new Map<PlatformName, ChartSourceAdapter>();

export function enregistrerAdaptateur(adaptateur: ChartSourceAdapter): void {
  registre.set(adaptateur.platform, adaptateur);
}

export function obtenirAdaptateur(platform: PlatformName): ChartSourceAdapter | undefined {
  return registre.get(platform);
}

export function listerAdaptateurs(): ChartSourceAdapter[] {
  return [...registre.values()];
}

/**
 * Exécute fetchChart de façon isolée : renvoie toujours un RawChartResult,
 * jamais d'exception.
 */
export async function collecteIsolee(
  platform: PlatformName,
  context: ChartFetchContext
): Promise<RawChartResult> {
  const adaptateur = registre.get(platform);
  if (!adaptateur) {
    return {
      sourceKey: context.sourceKey,
      ingestionMode: "DISABLED",
      status: "error",
      fetchedAt: new Date().toISOString(),
      rows: [],
      message: `Aucun adaptateur enregistré pour ${platform}.`,
    };
  }
  try {
    return await adaptateur.fetchChart(context);
  } catch (e) {
    return {
      sourceKey: context.sourceKey,
      ingestionMode: adaptateur.ingestionMode,
      status: "error",
      fetchedAt: new Date().toISOString(),
      rows: [],
      message: e instanceof Error ? e.message : "Erreur inconnue de l'adaptateur.",
    };
  }
}
