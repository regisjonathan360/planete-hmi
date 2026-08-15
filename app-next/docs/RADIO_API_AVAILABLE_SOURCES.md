# API Route: GET /api/admin/radio/available-sources

## Description

Cette route retourne les sources disponibles pour la configuration de la radio. Elle combine deux types de sources :

1. **Classements (Charts)** : Les éditions publiées des classements musicaux
2. **Sources de collecte** : Les playlists manuelles et les sources de collecte automatique (YouTube, Spotify, Deezer, etc.)

## Authentification

- **Requis** : Admin role
- **Méthode** : Bearer token dans l'en-tête `Authorization`
- **Réponse non-authentifiée** : 401 Unauthorized
- **Réponse non-admin** : 403 Forbidden

## Endpoint

```http
GET /api/admin/radio/available-sources
Authorization: Bearer {token}
```

## Réponse 200 OK

```json
{
  "charts": [
    {
      "id": "uuid-chart-edition-1",
      "name": "Top Spotify Week 1",
      "track_count": 50,
      "platform": "spotify"
    },
    {
      "id": "uuid-chart-edition-2",
      "name": "Top YouTube Viral",
      "track_count": 100,
      "platform": "youtube"
    }
  ],
  "sources": [
    {
      "id": "uuid-playlist-1",
      "name": "Ma Playlist Manuelle",
      "description": "Playlist créée manuellement par l'admin",
      "track_count": 20,
      "type": "manual"
    },
    {
      "id": "uuid-source-1",
      "name": "Spotify Top 50",
      "track_count": 0,
      "type": "spotify"
    },
    {
      "id": "uuid-source-2",
      "name": "YouTube Hits",
      "track_count": 0,
      "type": "youtube"
    },
    {
      "id": "uuid-source-3",
      "name": "TikTok Trending",
      "track_count": 0,
      "type": "tiktok"
    }
  ]
}
```

## Réponses d'erreur

### 401 Unauthorized
```json
{
  "error": {
    "code": "unauthorized",
    "message": "Non authentifié."
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "code": "forbidden",
    "message": "Accès réservé aux administrateurs."
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "code": "database_error",
    "message": "Impossible de récupérer les classements"
  }
}
```

## Structure des données

### Classements (Charts)

Chaque objet de classement inclut :

| Propriété | Type | Description |
|-----------|------|-------------|
| id | string | UUID unique de l'édition du classement |
| name | string | Nom d'affichage du classement |
| track_count | number | Nombre de chansons dans le classement |
| platform | string | Plateforme source (spotify, youtube, tiktok, audiomack, deezer, etc.) |

**Notes** :
- Seules les éditions avec le statut "published" sont retournées
- Les classements sont triés par date décroissante (plus récent en premier)

### Sources de collecte (Sources)

Chaque objet source inclut :

| Propriété | Type | Description |
|-----------|------|-------------|
| id | string | UUID unique de la source |
| name | string | Nom d'affichage de la source |
| description | string (optionnel) | Description de la source (pour les playlists) |
| track_count | number | Nombre de pistes dans la source (pour les playlists uniquement) |
| type | string | Type de source ("manual", "spotify", "youtube", "tiktok", "audiomack", "deezer", etc.) |

**Notes** :
- Seules les sources habilitées (`is_enabled = true`) sont retournées
- Pour les sources de collecte (chart_sources), `track_count` est 0 (elles stockent le nombre de pistes dans chart_entries)
- Pour les playlists manuelles (radio_playlists), `track_count` est calculé à partir de radio_playlist_tracks
- Les playlists sont triées par nom (A-Z)

## Utilisation en frontend

### Example avec fetch

```javascript
async function getAvailableSources(token) {
  const response = await fetch('/api/admin/radio/available-sources', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Erreur:', error.error.message);
    return null;
  }

  const data = await response.json();
  return data;
}

// Utilisation
const sources = await getAvailableSources(authToken);
console.log('Classements:', sources.charts);
console.log('Sources:', sources.sources);
```

### Example avec axios

```javascript
import axios from 'axios';

async function getAvailableSources(token) {
  try {
    const response = await axios.get('/api/admin/radio/available-sources', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Non authentifié');
    } else if (error.response?.status === 403) {
      console.error('Accès non autorisé');
    } else {
      console.error('Erreur serveur:', error.message);
    }
    return null;
  }
}
```

### Exemple avec SWR (React)

```javascript
import useSWR from 'swr';

export function useAvailableSources(token) {
  const { data, error, isLoading } = useSWR(
    token ? '/api/admin/radio/available-sources' : null,
    (url) =>
      fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then((res) => res.json())
  );

  return {
    sources: data,
    error,
    isLoading
  };
}

// Utilisation dans composant
export function RadioSourceSelector() {
  const { sources, isLoading, error } = useAvailableSources(authToken);

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error.message}</div>;

  return (
    <div>
      <h3>Classements disponibles</h3>
      <select>
        {sources?.charts.map((chart) => (
          <option key={chart.id} value={chart.id}>
            {chart.name} ({chart.track_count} chansons)
          </option>
        ))}
      </select>

      <h3>Sources de collecte</h3>
      <select>
        {sources?.sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name} ({source.track_count > 0 ? `${source.track_count} pistes` : 'Source'})
          </option>
        ))}
      </select>
    </div>
  );
}
```

## Cas d'usage

### 1. Initialiser un formulaire de configuration radio

```javascript
// Charger les sources disponibles pour le formulaire de sélection
const { charts, sources } = await getAvailableSources(token);

// Peupler les sélecteurs
populateChartSelector(charts);
populateSourceSelector(sources);
```

### 2. Valider une sélection

```javascript
// Vérifier que le classement/source sélectionné existe
function isValidChart(chartId, availableSources) {
  return availableSources.charts.some(c => c.id === chartId);
}

function isValidSource(sourceId, availableSources) {
  return availableSources.sources.some(s => s.id === sourceId);
}
```

### 3. Afficher les infos de contenu

```javascript
// Afficher le nombre de chansons en temps réel
function displaySourceInfo(sourceId, availableSources) {
  const chart = availableSources.charts.find(c => c.id === sourceId);
  if (chart) {
    return `${chart.track_count} chansons - Plateforme: ${chart.platform}`;
  }

  const source = availableSources.sources.find(s => s.id === sourceId);
  if (source) {
    return `${source.name} (${source.type})${source.track_count > 0 ? ` - ${source.track_count} pistes` : ''}`;
  }

  return 'Source inconnue';
}
```

## Performance

- **Cache recommandé** : 60 secondes (les classements/sources ne changent pas fréquemment)
- **Pagination** : Non nécessaire (le nombre de sources est généralement limité)

## Notes techniques

### Bases de données utilisées

1. **chart_editions** : Classements publiés (status = 'published')
   - Jointure avec chart_sources pour récupérer le nom et la plateforme
   
2. **chart_sources** : Sources de collecte habilitées
   - Filtre : is_enabled = true
   
3. **radio_playlists** : Playlists manuelles
   
4. **radio_playlist_tracks** : Pistes des playlists
   - Utilisé pour compter le nombre de pistes par playlist

### Permissions Supabase

La route utilise le client Supabase admin (service-role), ce qui contourne les RLS (Row Level Security).

### Optimisations possibles

1. **Cache côté application** : Implémenter un cache local pour réduire les requêtes
2. **Index Supabase** : Vérifier que les colonnes filtrées (status, is_enabled) sont indexées
3. **Pagination** : Si le nombre de sources explose, implémenter la pagination

## Dépannage

### La réponse est vide

- Vérifier qu'il existe des classements avec le statut "published"
- Vérifier que les sources ont is_enabled = true
- Vérifier les logs serveur

### Token invalide

- Vérifier que le token est valide et n'a pas expiré
- Vérifier que l'utilisateur a le rôle "admin" dans user_roles

### Erreur 500

- Vérifier que NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY sont correctement configurés
- Vérifier les logs serveur pour plus de détails
