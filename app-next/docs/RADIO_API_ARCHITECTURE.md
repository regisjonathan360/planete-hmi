# Architecture - API Radio: Available Sources

## Vue d'ensemble

Cette documentation décrit l'architecture complète de la nouvelle API et ses composants.

## Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Page Admin: radio/config/page.tsx              │   │
│  │  - Affiche formulaire de configuration radio           │   │
│  │  - Utilise AvailableSourcesSelector                    │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼────────────────────────────────────┐   │
│  │      <AvailableSourcesSelector />                      │   │
│  │  - Composant React réutilisable                        │   │
│  │  - Appelle useAvailableSources()                       │   │
│  │  - Affiche sélecteurs (charts + sources)              │   │
│  │  - Gère l'état et les erreurs                          │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
│  ┌────────────────────▼────────────────────────────────────┐   │
│  │         useAvailableSources() Hook                      │   │
│  │  - Effectue fetch vers /api/admin/radio/available-s... │   │
│  │  - Gère l'état (loading, error, data)                  │   │
│  │  - Utilise types de lib/radio/schemas.ts               │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
│                       │ fetch (GET)                             │
└───────────────────────┼─────────────────────────────────────────┘
                        │
                        │ HTTP Request
                        │ Authorization: Bearer {token}
                        │ Content-Type: application/json
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                      Backend (Next.js API)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Route: GET /api/admin/radio/available-sources/        │   │
│  │  (src/app/api/admin/radio/available-sources/route.ts)  │   │
│  │                                                          │   │
│  │  1. requireAdmin() - Vérifier authentification          │   │
│  │     ├─ getUser() - Récupérer l'utilisateur            │   │
│  │     └─ user_roles - Vérifier le rôle admin            │   │
│  │                                                          │   │
│  │  2. Créer admin client Supabase                         │   │
│  │     └─ createAdminClient() - Service role              │   │
│  │                                                          │   │
│  │  3. Récupérer les données                              │   │
│  │     ├─ chart_editions (published)                      │   │
│  │     ├─ chart_sources (enabled)                         │   │
│  │     ├─ radio_playlists                                 │   │
│  │     └─ radio_playlist_tracks (count)                   │   │
│  │                                                          │   │
│  │  4. Transformer et structurer                           │   │
│  │     ├─ Formater charts: {id, name, track_count, platform} │
│  │     └─ Formater sources: {id, name, track_count, type} │   │
│  │                                                          │   │
│  │  5. Retourner la réponse JSON                           │   │
│  │     └─ {charts: [], sources: []}                       │   │
│  │                                                          │   │
│  └────┬─────────────────────────────────────────┬──────────┘   │
│       │ Erreurs                                 │                │
│       │ (401, 403, 500)                         │                │
│       │                                         │ Succès         │
└───────┼─────────────────────────────────────────┼────────────────┘
        │                                         │
        │ HTTP Response (Error)                  │ HTTP Response (200)
        │ {error: {...}}                         │ {charts: [...], 
        │                                         │  sources: [...]}
        │                                         │
┌───────▼─────────────────────────────────────────▼────────────────┐
│                      Frontend (Error Handler)                     │
├─────────────────────────────────────────────────────────────────┤
│  - Afficher message d'erreur                                    │
│  - Retry automatique ou manuel                                  │
│  - Logging                                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Flux de données

### 1. Flux initial de chargement

```
┌─────────────────────┐
│  Page chargée       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  useAvailableSources() exécuté           │
│  - État: isLoading = true                │
│  - État: data = null                     │
│  - État: error = null                    │
└──────────┬──────────────────────────────┘
           │
           │ useEffect + fetch()
           │
           ▼
┌─────────────────────────────────────────┐
│  Requête API                             │
│  GET /api/admin/radio/available-sources  │
│  Authorization: Bearer {token}           │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Serveur traite la requête               │
│  1. Vérifier authentification (admin)    │
│  2. Requêtes Supabase                    │
│  3. Transformer données                  │
│  4. Retourner JSON                       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Hook met à jour l'état                  │
│  - État: isLoading = false               │
│  - État: data = {...}                    │
│  - État: error = null                    │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Composant re-render avec données        │
│  - Afficher sélecteurs                   │
│  - Afficher options                      │
└─────────────────────────────────────────┘
```

### 2. Flux de sélection

```
Utilisateur sélectionne un classement
         │
         ▼
Appel onSelectChart(chartId)
         │
         ▼
handleSelectChart() mis à jour
         │
         ├─ setSelectedChart(chartId)
         │
         ├─ Trouver chart dans data
         │
         └─ Mettre à jour config
             └─ setConfig({...chart_source_key})
             
         ▼
Afficher info du classement sélectionné
```

### 3. Flux de sauvegarde

```
Utilisateur clique "Sauvegarder"
         │
         ▼
handleSaveConfig()
         │
         ├─ Validation (optionnel)
         │
         │ await fetch('/api/admin/radio/config', {
         │   method: 'PUT',
         │   body: config
         │ })
         │
         ▼
     Réponse
    ╱       ╲
   ✓         ✗
  /           \
 v             v
Succès      Erreur
Afficher    Afficher
message     message
```

## Composants et dépendances

### Client (Frontend)

```
AvailableSourcesSelector.tsx
├── React (useState, useEffect)
├── fetch API
└── Affichage UI

useAvailableSources()
├── React hooks (useState, useEffect)
└── fetch API

Schémas (schemas.ts)
├── Types TypeScript
├── Validation Zod
└── Helpers
```

### Serveur (Backend)

```
route.ts (GET /api/admin/radio/available-sources)
├── Next.js Response
├── requireAdmin() - Auth
│   ├── createClient() - Supabase user session
│   └── user_roles - Vérifier admin
├── createAdminClient() - Supabase admin
│   ├── chart_editions
│   ├── chart_sources
│   ├── radio_playlists
│   └── radio_playlist_tracks
└── Gestion erreurs
```

## Stockage des données (Supabase)

### Tables impliquées

```
┌─────────────────────┐
│  chart_editions     │ (Classements)
├─────────────────────┤
│ id (PK)             │
│ chart_source_id (FK)│
│ entry_count         │ ← track_count
│ status = 'published'│ (Filtre)
│ period_start        │
│ period_end          │
│ ...                 │
└──────────┬──────────┘
           │ JOIN
           ▼
┌─────────────────────┐
│  chart_sources      │ (Sources)
├─────────────────────┤
│ id (PK)             │
│ display_name        │ ← name
│ platform            │
│ is_enabled = true   │ (Filtre)
│ source_key          │
│ ...                 │
└─────────────────────┘

┌─────────────────────┐
│ radio_playlists     │ (Playlists)
├─────────────────────┤
│ id (PK)             │
│ name                │
│ description         │
│ is_active           │
│ ...                 │
└──────────┬──────────┘
           │ JOIN
           ▼
┌─────────────────────────┐
│ radio_playlist_tracks   │ (Pistes)
├─────────────────────────┤
│ id (PK)                 │
│ playlist_id (FK)        │ ← COUNT by playlist_id
│ track_position          │
│ ...                     │
└─────────────────────────┘
```

## Types de données

### Entrée (HTTP Request)
```
GET /api/admin/radio/available-sources
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Sortie (HTTP Response 200)
```json
{
  "charts": [
    {
      "id": "uuid",
      "name": "string",
      "track_count": number,
      "platform": "string"
    }
  ],
  "sources": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string | undefined",
      "track_count": number,
      "type": "string"
    }
  ]
}
```

### Sortie (HTTP Response Error)
```json
{
  "error": {
    "code": "unauthorized|forbidden|database_error|internal_error",
    "message": "string"
  }
}
```

## Authentification et autorisation

```
┌────────────────────────────┐
│  Request avec Bearer Token  │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────────┐
│  requireAdmin()                 │
├────────────────────────────────┤
│  1. createClient() - User session
│  2. supabase.auth.getUser()   │
│                               │
│  ├─ SUCCESS ─────────────────┐│
│  │ User ID trouvé           ││
│  │ ▼                        ││
│  │ Requête user_roles       ││
│  │ WHERE user_id = X        ││
│  │ AND role = 'admin'       ││
│  │                          ││
│  ├─ FOUND ──────────────────┐││
│  │ Retourner {ok, user}     │││
│  │                          │││
│  └─ NOT FOUND ──────────────┐│││
│    Retourner {ok: false,  │││
│    status: 403}           │││
│                          │││
│  └─ NOT FOUND ──────────────┐│
│    Retourner {ok: false,    │
│    status: 401}             │
└────────────────────────────────┘
```

## Gestion des erreurs

```
Erreur possible
       │
       ├─ 401 Unauthorized
       │  └─ Utilisateur non authentifié
       │
       ├─ 403 Forbidden
       │  └─ Utilisateur non admin
       │
       ├─ 500 Internal Server Error
       │  ├─ Erreur Supabase
       │  └─ Erreur du serveur
       │
       └─ 200 Success (même avec données vides)
           └─ {charts: [], sources: []}
```

## Performance et optimisation

### Requêtes optimisées

1. **chart_editions** :
   - Filtré côté serveur (status = 'published')
   - Avec join chart_sources
   - Pas de N+1

2. **chart_sources** :
   - Filtré côté serveur (is_enabled = true)
   - Pas de join inutile
   - Sélection spécifique des colonnes

3. **radio_playlists** :
   - SELECT simple
   - Pas de join inutile

4. **radio_playlist_tracks** :
   - COUNT agrégé
   - IN filter pour les playlist IDs
   - Pas de N+1

### Temps de réponse typique

```
Requête API                      → ~100ms total
├─ Network latency               → ~10-20ms
├─ Authentification              → ~5ms
├─ Requête chart_editions        → ~10ms
├─ Requête chart_sources         → ~5ms
├─ Requête radio_playlists       → ~5ms
├─ Requête radio_playlist_tracks → ~10ms
├─ Transformation des données    → ~5ms
└─ Sérialisation JSON            → ~5ms
```

### Cache recommandé

```
Côté client (React):
- Cache Supabase: 60 secondes
- Invalidation manuelle possible
- Retry automatique après 60s

Côté serveur:
- Cache Supabase: 30 secondes (optionnel)
- Invalidation via webhooks (future)
```

## Diagramme de sequence

```
Client                          Server              Supabase
  │                               │                    │
  │─ GET /api/admin/radio/... ──→│                    │
  │                               │                    │
  │                               │─ requireAdmin()   │
  │                               │                    │
  │                               │─ getUser() ───────→│
  │                               │←─ user object ────│
  │                               │                    │
  │                               │─ user_roles ──────→│
  │                               │←─ admin role ─────│
  │                               │                    │
  │                               │─ chart_editions ──→│
  │                               │←─ charts data ────│
  │                               │                    │
  │                               │─ chart_sources ───→│
  │                               │←─ sources data ───│
  │                               │                    │
  │                               │─ radio_playlists →│
  │                               │←─ playlists ──────│
  │                               │                    │
  │                               │─ counts ──────────→│
  │                               │←─ counts ─────────│
  │                               │                    │
  │                               │ [Transform]        │
  │                               │                    │
  │←─ JSON Response (200) ────────│                    │
  │                               │                    │
  │ [Update State]                │                    │
  │ [Re-render UI]                │                    │
  │                               │                    │
```

## Considérations de sécurité

1. **Authentification** : Vérifiée via JWT
2. **Autorisation** : Rôle admin requis
3. **Données** : Pas de données sensibles exposées
4. **Erreurs** : Pas de stack trace en production
5. **SQL** : Pas de SQL injection (Supabase client)
6. **CORS** : Géré par Next.js

## Considérations de scalabilité

### Futur (si nombre de sources explose)

1. **Pagination** :
   ```typescript
   GET /api/admin/radio/available-sources?page=1&limit=20
   ```

2. **Filtrage** :
   ```typescript
   GET /api/admin/radio/available-sources?type=manual&platform=spotify
   ```

3. **Cache distribué** :
   - Redis pour cache côté serveur
   - Invalidation via webhooks

4. **Monitoring** :
   - Tracking des appels API
   - Alertes sur erreurs
   - Logging structuré

## Liens aux fichiers

- [Route API](../src/app/api/admin/radio/available-sources/route.ts)
- [Composant React](../src/components/admin/radio/AvailableSourcesSelector.tsx)
- [Schémas TypeScript](../src/lib/radio/schemas.ts)
- [Tests](../tests/integration/radio-available-sources.test.ts)
- [Documentation API](./RADIO_API_AVAILABLE_SOURCES.md)
- [Exemples d'intégration](./RADIO_API_INTEGRATION_EXAMPLE.md)
