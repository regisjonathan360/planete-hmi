# Exemple d'intégration : Configuration Radio avec Sources

Ce document fournit un exemple complet d'intégration de la route `/api/admin/radio/available-sources` dans un formulaire d'administration radio.

## Vue d'ensemble

L'API retourne les sources disponibles pour :
1. Configurer la radio (classements ou playlists)
2. Afficher les options disponibles à l'admin
3. Valider les sélections avant l'envoi au serveur

## Structure complète d'une page admin

### Fichier : `src/app/admin/radio/config/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { AvailableSourcesSelector, useAvailableSources } from '@/components/admin/radio/AvailableSourcesSelector';

interface RadioConfig {
  active_playlist_id: string | null;
  auto_switch_to_chart: boolean;
  chart_source_key: string | null;
  preload_count: number;
  crossfade_duration_ms: number;
  is_live: boolean;
}

export default function RadioConfigPage() {
  const { charts, sources, isLoading, error: loadError } = useAvailableSources();
  const [selectedChart, setSelectedChart] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [config, setConfig] = useState<RadioConfig>({
    active_playlist_id: null,
    auto_switch_to_chart: true,
    chart_source_key: null,
    preload_count: 5,
    crossfade_duration_ms: 1000,
    is_live: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSelectChart = (chartId: string) => {
    setSelectedChart(chartId);
    const chart = charts.find((c) => c.id === chartId);
    if (chart) {
      setConfig((prev) => ({
        ...prev,
        chart_source_key: chartId,
      }));
    }
  };

  const handleSelectSource = (sourceId: string) => {
    setSelectedSource(sourceId);
    const source = sources.find((s) => s.id === sourceId);
    if (source && source.type === 'manual') {
      setConfig((prev) => ({
        ...prev,
        active_playlist_id: sourceId,
      }));
    }
  };

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const response = await fetch('/api/admin/radio/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur inconnue s\'est produite';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded">
        <h1 className="text-2xl font-bold text-red-900 mb-4">Erreur</h1>
        <p className="text-red-700">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Configuration de la Radio</h1>

      {/* Notifications */}
      {saveSuccess && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 rounded text-green-700">
          ✓ Configuration sauvegardée avec succès
        </div>
      )}
      {saveError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 rounded text-red-700">
          ✗ Erreur : {saveError}
        </div>
      )}

      {/* Sélecteur de sources */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-6">Sélectionner les sources</h2>
        {isLoading ? (
          <p className="text-gray-600">Chargement...</p>
        ) : (
          <AvailableSourcesSelector
            onSelectChart={handleSelectChart}
            onSelectSource={handleSelectSource}
            initialChartId={selectedChart}
            initialSourceId={selectedSource}
          />
        )}
      </div>

      {/* Paramètres avancés */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold mb-6">Paramètres avancés</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de pistes à pré-charger
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.preload_count}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  preload_count: parseInt(e.target.value),
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Durée du fondu enchaîné (ms)
            </label>
            <input
              type="number"
              min="0"
              max="10000"
              step="100"
              value={config.crossfade_duration_ms}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  crossfade_duration_ms: parseInt(e.target.value),
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.auto_switch_to_chart}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    auto_switch_to_chart: e.target.checked,
                  }))
                }
                className="w-4 h-4 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Basculer automatiquement vers le classement
              </span>
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.is_live}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    is_live: e.target.checked,
                  }))
                }
                className="w-4 h-4 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Transmission en direct
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => window.history.back()}
          className="px-6 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
```

## Formulaire simplifié

Pour une intégration plus simple, vous pouvez utiliser directement le composant :

```typescript
import { AvailableSourcesSelector } from '@/components/admin/radio/AvailableSourcesSelector';

export default function SimpleRadioForm() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuration Radio</h1>
      <AvailableSourcesSelector
        onSelectChart={(chartId) => console.log('Chart:', chartId)}
        onSelectSource={(sourceId) => console.log('Source:', sourceId)}
      />
    </div>
  );
}
```

## Hook personnalisé avancé

Créez un hook pour la gestion d'état complexe :

```typescript
// src/hooks/useRadioConfiguration.ts

import { useEffect, useState } from 'react';

interface RadioConfig {
  active_playlist_id: string | null;
  auto_switch_to_chart: boolean;
  chart_source_key: string | null;
  preload_count: number;
  crossfade_duration_ms: number;
  is_live: boolean;
}

export function useRadioConfiguration() {
  const [config, setConfig] = useState<RadioConfig | null>(null);
  const [sources, setSources] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger la configuration et les sources disponibles
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Charger les sources disponibles
        const sourcesResponse = await fetch('/api/admin/radio/available-sources');
        if (!sourcesResponse.ok) throw new Error('Erreur lors du chargement des sources');
        const sourcesData = await sourcesResponse.json();
        setSources(sourcesData);

        // Charger la configuration actuelle
        const configResponse = await fetch('/api/admin/radio/config');
        if (!configResponse.ok) throw new Error('Erreur lors du chargement de la configuration');
        const configData = await configResponse.json();
        setConfig(configData);

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const updateConfig = (updates: Partial<RadioConfig>) => {
    setConfig((prev) => prev ? { ...prev, ...updates } : null);
  };

  const saveConfig = async () => {
    if (!config) return;
    const response = await fetch('/api/admin/radio/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error('Erreur lors de la sauvegarde');
    return response.json();
  };

  return {
    config,
    sources,
    isLoading,
    error,
    updateConfig,
    saveConfig,
  };
}
```

## Validation des sélections

Implémentez une validation avant la sauvegarde :

```typescript
function validateRadioConfig(config: RadioConfig, sources: any): string[] {
  const errors: string[] = [];

  // Vérifier qu'une source est sélectionnée
  if (!config.chart_source_key && !config.active_playlist_id) {
    errors.push('Vous devez sélectionner au least une source');
  }

  // Vérifier que le classement existe
  if (config.chart_source_key) {
    const chartExists = sources?.charts?.some((c: any) => c.id === config.chart_source_key);
    if (!chartExists) {
      errors.push('Le classement sélectionné n\'existe pas');
    }
  }

  // Vérifier que la playlist existe
  if (config.active_playlist_id) {
    const playlistExists = sources?.sources?.some((s: any) => s.id === config.active_playlist_id);
    if (!playlistExists) {
      errors.push('La playlist sélectionnée n\'existe pas');
    }
  }

  // Vérifier les paramètres avancés
  if (config.preload_count < 1 || config.preload_count > 10) {
    errors.push('Le nombre de pistes à pré-charger doit être entre 1 et 10');
  }

  if (config.crossfade_duration_ms < 0 || config.crossfade_duration_ms > 10000) {
    errors.push('La durée du fondu doit être entre 0 et 10000 ms');
  }

  return errors;
}

// Utilisation
const validationErrors = validateRadioConfig(config, sources);
if (validationErrors.length > 0) {
  // Afficher les erreurs à l'utilisateur
  validationErrors.forEach((error) => console.error(error));
  return;
}
```

## Chargement de la configuration actuelle

Après avoir sauvegardé, vous pouvez recharger la configuration :

```typescript
async function reloadRadioConfig() {
  try {
    const response = await fetch('/api/admin/radio/config');
    if (!response.ok) throw new Error('Erreur de chargement');
    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Erreur:', error);
    return null;
  }
}
```

## Gestion des erreurs globales

```typescript
async function withErrorHandling(
  operation: () => Promise<void>,
  onError: (message: string) => void
) {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    onError(message);
    console.error('[ERROR]', message);
  }
}

// Utilisation
await withErrorHandling(
  async () => {
    await saveConfig();
  },
  (message) => {
    setSaveError(message);
  }
);
```

## Points clés

1. **Authentification** : La route nécessite un token admin valide
2. **Cache** : Considérez une cache de 60 secondes pour optimiser les performances
3. **Validation** : Validez toujours les sélections avant la sauvegarde
4. **Feedback utilisateur** : Fournissez un retour clair (succès/erreur)
5. **Gestion d'état** : Utilisez React hooks pour gérer l'état du formulaire
6. **Accessibilité** : Utilisez des labels et ARIA pour l'accessibilité
