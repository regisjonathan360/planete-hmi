# Audit d'intégration — Top YouTube HMI

## Conclusion

Le projet dispose déjà du socle transversal des classements. Le module YouTube
doit être une extension spécialisée, pas une nouvelle application.

## Éléments existants à réutiliser

| Besoin du cahier | Élément existant |
|---|---|
| Artistes et chansons | `artists`, `tracks`, `track_artists` |
| Identité d'une vidéo sur une plateforme | `platform_tracks` |
| Source et période de classement | `chart_sources`, `chart_editions` |
| Top 20 et historique de rang | `chart_entries` |
| Exécutions de collecte | `sync_runs` |
| Journal administratif | `chart_audit_logs` |
| Contrôle administrateur | `src/lib/auth/admin-guard.ts` |
| Calcul des mouvements et du peak | `src/lib/charts/ranking/*` |
| Publication et restauration | `src/lib/charts/admin/publish.ts` |
| Lecture publique | `src/lib/charts/queries/*` |
| Pages publiques | `src/app/charts/*` |
| Adaptateur YouTube | `src/lib/charts/adapters/youtube.ts` |

## Lacunes réelles

- Aucune table spécialisée pour les chaînes, vidéos suivies, associations
  multi-vidéos et snapshots YouTube.
- Les Edge Functions YouTube présentes retournent encore une réponse non
  implémentée.
- Aucune administration des sources ou file de vérification YouTube.
- Aucun orchestrateur avec verrou, progression, annulation et reprise.
- Aucun workflow YouTube complet de brouillon à publication.

## Conflits à résoudre dans la migration

- Les statuts du cahier sont en majuscules, tandis que le système de charts
  existant utilise des valeurs minuscules. La base doit conserver un vocabulaire
  canonique et exposer les libellés UI séparément.
- `chart_editions` joue déjà le rôle de `chart_periods` recommandé. Ne pas créer
  une table concurrente.
- `chart_audit_logs` remplace déjà `admin_audit_logs`.
- `sync_runs` peut être étendue pour la progression ; une nouvelle table de
  collecte n'est justifiée que si l'extension devient incohérente.
- `chart_entries` devra recevoir ou référencer les métriques YouTube nécessaires
  sans écraser les données sources.

## Travail direct déjà livré

Les contrats, validations, calculs purs, contrôles avant publication et tests
unitaires sont placés sous `src/lib/youtube/`. Ils n'accèdent ni à Supabase ni à
YouTube et peuvent donc être vérifiés indépendamment avant les travaux Kiro.

## Références officielles

- `channels.list` permet d'obtenir la playlist d'uploads via
  `contentDetails.relatedPlaylists.uploads`.
- `videos.list` permet de demander les parties `snippet`, `contentDetails`,
  `status` et `statistics`.
- Les opérations de lecture consomment du quota ; la collecte doit regrouper les
  IDs et éviter `search.list` comme mécanisme principal.
