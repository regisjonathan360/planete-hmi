# Design d'intégration — Top YouTube HMI

## Réutilisation obligatoire

Le projet possède déjà :

- `artists`, `tracks`, `track_artists` et `platform_tracks` ;
- `chart_sources`, `chart_editions`, `chart_entries` ;
- `sync_runs` et `chart_audit_logs` ;
- la garde serveur `requireAdmin` ;
- les fonctions de mouvement, historique, validation et publication ;
- `/charts`, `/charts/[platform]` et les composants publics communs ;
- un adaptateur YouTube et deux Edge Functions encore incomplètes.

Kiro doit étendre ces éléments, pas créer un second système de charts.

## Nouvelles tables spécialisées minimales

La migration complexe devra privilégier :

- `youtube_channels` pour les sources approuvées ;
- `youtube_videos` pour les métadonnées sources et l'état éditorial séparé ;
- `youtube_track_assets` pour l'association plusieurs vidéos → une chanson ;
- `youtube_metric_snapshots` pour les relevés immuables ;
- extension de `sync_runs` ou table spécialisée uniquement si les champs de
  progression ne peuvent pas être ajoutés proprement.

`chart_editions`, `chart_entries` et `chart_audit_logs` doivent être réutilisées.

## Modules simples déjà préparés

- `src/lib/youtube/constants.ts`
- `src/lib/youtube/types.ts`
- `src/lib/youtube/schemas.ts`
- `src/lib/youtube/ranking.ts`
- `src/lib/youtube/validate-draft.ts`

Ces modules sont sans accès réseau ni accès base. Kiro peut les brancher aux
services et routes après stabilisation de la migration.

## Services complexes attendus

1. Client serveur YouTube Data API v3.
2. Découverte par playlist d'uploads des chaînes approuvées.
3. Rafraîchissement des vidéos par lots.
4. Orchestrateur idempotent avec verrou, progression et annulation.
5. Écriture transactionnelle des snapshots et du brouillon.
6. Publication/révision/restauration atomiques.

## Séparation des données

- Les champs `source_*`, les compteurs, la date de publication, les réponses
  brutes et les snapshots ne sont jamais écrasés par l'administration.
- Les titres, miniatures, associations, types, éligibilité et notes éditoriales
  vivent dans des champs séparés.
- Chaque intervention manuelle exige une raison dans `chart_audit_logs`.

## Documentation API vérifiée

Le service doit utiliser les ressources officielles `channels.list`,
`playlistItems.list` et `videos.list`. La playlist d'uploads est fournie par
`contentDetails.relatedPlaylists.uploads`. Les statistiques et métadonnées
doivent être lues côté serveur et la page publique doit uniquement lire
Supabase.
