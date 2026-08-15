/**
 * Composant : AvailableSourcesSelector
 * 
 * Affiche les classements et sources disponibles pour la configuration radio.
 * Utilise l'API /api/admin/radio/available-sources pour charger les données.
 * 
 * Exemple d'utilisation :
 * <AvailableSourcesSelector 
 *   onSelectChart={(id) => console.log('Chart sélectionné:', id)}
 *   onSelectSource={(id) => console.log('Source sélectionnée:', id)}
 * />
 */

'use client';

import { useEffect, useState } from 'react';

interface ChartOption {
  id: string;
  name: string;
  track_count: number;
  platform: string;
}

interface SourceOption {
  id: string;
  name: string;
  description?: string;
  track_count: number;
  type: string;
}

interface AvailableSourcesData {
  charts: ChartOption[];
  sources: SourceOption[];
}

interface Props {
  onSelectChart?: (chartId: string) => void;
  onSelectSource?: (sourceId: string) => void;
  initialChartId?: string;
  initialSourceId?: string;
}

export function AvailableSourcesSelector({
  onSelectChart,
  onSelectSource,
  initialChartId,
  initialSourceId,
}: Props) {
  const [data, setData] = useState<AvailableSourcesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChart, setSelectedChart] = useState<string>(initialChartId || '');
  const [selectedSource, setSelectedSource] = useState<string>(initialSourceId || '');

  useEffect(() => {
    const fetchAvailableSources = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/radio/available-sources', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Erreur lors du chargement des sources');
        }

        const availableData: AvailableSourcesData = await response.json();
        setData(availableData);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Une erreur inconnue s\'est produite';
        setError(message);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailableSources();
  }, []);

  const handleChartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chartId = e.target.value;
    setSelectedChart(chartId);
    onSelectChart?.(chartId);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sourceId = e.target.value;
    setSelectedSource(sourceId);
    onSelectSource?.(sourceId);
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-100 rounded">
        <p className="text-gray-600">Chargement des sources disponibles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 rounded">
        <p className="text-red-700">Erreur : {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
        <p className="text-yellow-700">Aucune source disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Classements */}
      <div>
        <label htmlFor="chart-selector" className="block text-sm font-medium text-gray-700 mb-2">
          Classements disponibles ({data.charts.length})
        </label>
        <select
          id="chart-selector"
          value={selectedChart}
          onChange={handleChartChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Sélectionner un classement --</option>
          {data.charts.map((chart) => (
            <option key={chart.id} value={chart.id}>
              {chart.name} ({chart.track_count} chansons - {chart.platform})
            </option>
          ))}
        </select>
        {selectedChart && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            {(() => {
              const chart = data.charts.find((c) => c.id === selectedChart);
              return chart ? (
                <>
                  <strong>{chart.name}</strong>
                  <br />
                  <span className="text-gray-600">
                    {chart.track_count} chansons • Plateforme : {chart.platform}
                  </span>
                </>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Section Sources */}
      <div>
        <label htmlFor="source-selector" className="block text-sm font-medium text-gray-700 mb-2">
          Sources de collecte ({data.sources.length})
        </label>
        <select
          id="source-selector"
          value={selectedSource}
          onChange={handleSourceChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Sélectionner une source --</option>
          {data.sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
              {source.type === 'manual' ? ` (${source.track_count} pistes)` : ` - ${source.type}`}
            </option>
          ))}
        </select>
        {selectedSource && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            {(() => {
              const source = data.sources.find((s) => s.id === selectedSource);
              return source ? (
                <>
                  <strong>{source.name}</strong>
                  <br />
                  <span className="text-gray-600">
                    Type : {source.type}
                    {source.track_count > 0 && ` • ${source.track_count} pistes`}
                  </span>
                  {source.description && (
                    <>
                      <br />
                      <span className="text-gray-500 italic">{source.description}</span>
                    </>
                  )}
                </>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Résumé */}
      {(selectedChart || selectedSource) && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded">
          <h3 className="font-semibold text-purple-900 mb-2">Résumé de la configuration</h3>
          <ul className="text-sm text-purple-800 space-y-1">
            {selectedChart && (
              <li>
                ✓ Classement : <strong>{data.charts.find((c) => c.id === selectedChart)?.name}</strong>
              </li>
            )}
            {selectedSource && (
              <li>
                ✓ Source : <strong>{data.sources.find((s) => s.id === selectedSource)?.name}</strong>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Hook personnalisé pour utiliser disponibleSources
 * 
 * Exemple :
 * const { charts, sources, isLoading, error } = useAvailableSources();
 */
export function useAvailableSources() {
  const [data, setData] = useState<AvailableSourcesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAvailableSources = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/radio/available-sources');

        if (!response.ok) {
          throw new Error('Erreur lors du chargement des sources');
        }

        const availableData: AvailableSourcesData = await response.json();
        setData(availableData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur inconnue s\'est produite');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailableSources();
  }, []);

  return {
    charts: data?.charts || [],
    sources: data?.sources || [],
    isLoading,
    error,
    data,
  };
}
