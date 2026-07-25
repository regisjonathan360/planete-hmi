# Répartition des tâches — Top YouTube HMI

Objectif : économiser les 300 crédits Kiro. Les tâches mécaniques sont réalisées
directement dans le projet. Kiro ne doit recevoir que les tâches marquées `K`.

## D — Tâches réalisées directement

- [x] D1. Lire intégralement le cahier YouTube et auditer le dépôt.
- [x] D2. Documenter les composants, tables et services réutilisables.
- [x] D3. Créer les types et constantes du domaine YouTube.
  - Types de vidéos et de chaînes, statuts, modes de collecte et statuts charts.
  - Nom, sous-titre et méthodologie publics.
- [x] D4. Créer les schémas Zod.
  - IDs vidéo/chaîne/playlist, URL YouTube, source de chaîne, paramètres de
    collecte et réponse `videos.list`.
- [x] D5. Implémenter les calculs purs du classement V1.
  - Delta des compteurs, nouvelle vidéo, snapshot manquant, compteur en baisse,
    exclusion des Shorts, agrégation par chanson et départage.
- [x] D6. Implémenter les contrôles purs avant publication.
  - Erreurs bloquantes et avertissements du cahier des charges.
- [x] D7. Ajouter les tests unitaires des tâches D3 à D6.
- [x] D8. Préparer les exigences et le design d'intégration pour Kiro.
- [x] D9. Créer les composants visuels simples après stabilisation de K1.
  - Badges, états vides, avertissements et affichage de progression.
- [x] D10. Créer les formulaires simples après stabilisation des routes K3/K4.
  - Configuration de collecte et édition des champs éditoriaux.
  - Composants contrôlés validés par Zod, sans appel réseau, prêts pour K6.
- [x] D11. Compléter la documentation utilisateur et `.env.local.example`
  après stabilisation des contrats serveur.
  - Configuration YouTube/Vercel, première collecte, publication, révision,
    programmation et restauration documentées.

## K — Tâches complexes réservées à Kiro

> État final : K1 à K8 sont appliquées et vérifiées sur Supabase hébergé.
> Les migrations K5–K7 portent les versions distantes `20260725183534`,
> `20260725183644` et `20260725183658`.

- [x] K1. Migration Supabase spécialisée et RLS.
  - Étendre le schéma existant sans dupliquer `chart_editions`,
    `chart_entries`, `sync_runs` et `chart_audit_logs`.
  - Tables chaînes, vidéos, associations et snapshots ; contraintes
    d'idempotence ; suppression contrôlée ; politiques RLS.
- [x] K2. Client serveur YouTube Data API v3.
  - Validation d'une chaîne, playlist d'uploads, pagination, lots de vidéos,
    métadonnées/statistiques, quota, timeouts, erreurs partielles et secrets.
- [x] K3. Orchestrateur de collecte.
  - Verrou par période, protection double clic, reprise, annulation,
    progression, journal, idempotence et statut `COMPLETED_WITH_WARNINGS`.
  - Migration validée sur Supabase local avec deux sessions PostgreSQL
    concurrentes, puis appliquée et vérifiée sur Supabase hébergé.
- [x] K4. Découverte et file de vérification.
  - Nouvelles vidéos par chaînes approuvées, règles labels/distributeurs,
    dédoublonnage, association assistée et audit.
  - Service et adaptateur Supabase vérifiés : candidats `UNREVIEWED`,
    insertion idempotente, annulation propagée et secrets expurgés.
- [x] K5. Persistance transactionnelle des snapshots et calcul du brouillon.
  - Snapshots immuables, cas d'indisponibilité, rattachement multi-vidéos,
    branchement des fonctions pures D5/D6 et création du Top 20 brouillon.
  - Validation K5 v4 : 268 tests TypeScript, 20 scénarios PostgreSQL avec
    rollback, concurrence réelle sur deux sessions, build et lint YouTube.
- [x] K6. Routes serveur administratives sécurisées.
  - Sources, vidéos, collectes, progression, validation, recalcul, édition,
    prévisualisation et actions sensibles.
  - Validation finale locale : 395 tests, TypeScript, ESLint sans avertissement,
    build de production, lint PostgreSQL et concurrence/fencing réels.
- [x] K7. Publication, révision et restauration atomiques.
  - Archivage, programmation annulable, cache, historique et rollback sans
    état public partiel.
  - Historique immuable versionné, cron protégé, ancien état éditorial
    restaurable et invalidation du cache public.
- [x] K8. Tests d'intégration et de permissions.
  - API mockée, RLS, concurrence, collecte partielle, publication, archivage et
    restauration.
  - 401 tests TypeScript, 22 scénarios SQL K6, suite SQL K7 et deux tests
    PostgreSQL concurrents réels validés sur Supabase local.

## Dépendances et ordre économique

1. Donner uniquement K1 à Kiro.
2. Après validation de K1, réaliser directement D9 pendant que Kiro fait K2.
3. Donner K3, puis K4, puis K5 séparément à Kiro.
4. Réaliser directement D10 sur les contrats stabilisés.
5. Donner K6 et K7 séparément à Kiro.
6. Donner K8 seulement après réussite des tests unitaires directs.
7. Réaliser D11 et la vérification finale directement.

## Prompt initial minimal pour Kiro

> Lis `.kiro/steering/*` puis `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`.
> Inspecte les migrations existantes. Exécute uniquement K1. Réutilise les
> tables charts existantes, ne code aucun client API, aucune route et aucune UI.
> Fournis la migration, les contraintes, les politiques RLS et les tests SQL
> pertinents. Ne coche K1 qu'après vérification.

## Prompt K2 minimal pour Kiro

> Lis `.kiro/steering/*` puis
> `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`. K1 est terminée
> et vérifiée. Exécute uniquement K2 : le client serveur YouTube Data API v3.
> Implémente la validation d'une chaîne, la récupération de sa playlist
> d'uploads, la pagination de `playlistItems.list` et les appels `videos.list`
> par lots de 50 maximum pour les métadonnées, disponibilités et statistiques.
> Utilise exclusivement l'API officielle, garde la clé API côté serveur et
> réutilise les constantes, types et schémas Zod présents dans
> `src/lib/youtube`. Gère clairement les timeouts, quota épuisé, clé invalide,
> chaîne ou vidéo introuvable, vidéo privée/supprimée et réponses partielles,
> sans journaliser le secret. Ajoute des tests avec API simulée pour le succès,
> la pagination, le découpage en lots, les erreurs 403/404 et les IDs manquants.
> Ne modifie ni la migration K1, ni Supabase, ni les routes, ni l'orchestrateur,
> ni l'interface. Ne commence pas K3. Arrête-toi après les tests de K2 et fournis
> la liste exacte des fichiers modifiés et des contrôles exécutés.

## Prompt K3 minimal pour Kiro

> Lis `.kiro/steering/*` puis
> `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`. K1 et K2 sont
> terminées et vérifiées. Exécute uniquement K3 : l'orchestrateur serveur de
> collecte YouTube. Réutilise `sync_runs`, la source
> `youtube_hmi_weekly_delta`, les types existants et le client K2.
>
> Implémente un cycle idempotent avec création ou récupération d'une exécution,
> verrou atomique par source et période, protection contre le double clic,
> étapes explicites, progression persistée, compteurs, avertissements, erreurs,
> demande d'annulation, heartbeat, reprise sûre après interruption et statuts
> `PENDING`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED` et
> `CANCELLED`. Deux appels concurrents pour la même période ne doivent jamais
> lancer deux collectes.
>
> K3 doit seulement coordonner des étapes injectables. Ne développe pas encore
> la découverte métier K4, la persistance des snapshots ou le calcul du
> brouillon K5, les routes K6, la publication K7 ou l'interface. N'appelle pas
> réellement YouTube dans les tests.
>
> Inspecte d'abord le schéma réel de `sync_runs`. Privilégie sa colonne
> `metadata`. Si une garantie atomique exige une modification SQL, crée une
> migration idempotente minimale sans modifier K1 et explique pourquoi elle est
> indispensable. Ne l'applique pas sur Supabase hosted sans demande explicite.
>
> Ajoute des tests avec dépendances simulées pour : démarrage normal, double
> appel séquentiel, concurrence réelle, progression monotone, avertissements,
> erreur fatale, annulation avant et pendant une étape, reprise d'une exécution
> interrompue, verrou actif et verrou devenu obsolète. Vérifie que les secrets
> et réponses brutes de l'API ne sont jamais écrits dans `sync_runs`.
>
> Exécute les tests, TypeScript, ESLint sans avertissement et le build. Ne coche
> K3 qu'après réussite. Arrête-toi ensuite et fournis les fichiers modifiés,
> l'éventuelle migration non appliquée et les résultats exacts des contrôles.

## Prompt K4 minimal pour Kiro

> Lis `.kiro/steering/*`, le cahier des charges YouTube joint au projet, puis
> `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`. K1, K2 et K3
> sont terminées et vérifiées. La migration K3 officielle est
> `20260725000619_youtube_sync_lock.sql`.
>
> Exécute uniquement K4 : découverte des nouvelles vidéos provenant des chaînes
> YouTube approuvées et création idempotente de candidats dans la file de
> vérification. Réutilise strictement :
>
> - `src/lib/youtube/api-client.ts` pour la playlist d'uploads et les détails ;
> - l'interface d'étape injectable de `orchestrator.ts`, notamment
>   `ctx.assertActive()` pendant les traitements longs ;
> - `youtube_channels`, `youtube_channel_artists`, `youtube_videos`,
>   `youtube_track_assets` et `chart_audit_logs` créées par K1.
>
> Une chaîne collectable doit être active, approuvée et vérifiée. Compare chaque
> `video_id` découvert à la base avant de demander ou persister ses détails.
> L'écriture doit être idempotente : un même `video_id` ne crée jamais deux
> candidats, y compris après reprise ou deux pages contenant le même ID.
> Toute nouvelle vidéo doit rester `UNREVIEWED`, `is_eligible=false` et
> `video_type=UNKNOWN` par défaut. Ne l'approuve jamais automatiquement.
>
> Pour `LABEL_CHANNEL`, `DISTRIBUTOR_CHANNEL` et `COLLABORATOR_CHANNEL`, ne
> rattache automatiquement ni artiste ni chanson, même si la chaîne possède des
> artistes associés. Les suggestions éventuelles doivent rester séparées de la
> décision éditoriale et inclure une raison et un niveau de confiance. Ne
> transforme pas une simple durée courte en certitude qu'une vidéo est un Short.
>
> Mets à jour `last_scanned_at` et `last_scan_error` sans écraser les
> métadonnées sources ni les corrections éditoriales. Les vidéos privées,
> supprimées, manquantes ou les réponses partielles doivent produire des
> avertissements exploitables, sans faire échouer toute la collecte lorsque la
> suite peut continuer. Aucun secret, URL contenant la clé, réponse API brute ou
> description complète ne doit entrer dans les logs ou `sync_runs.metadata`.
>
> Organise K4 en services et stockage injectables, testables sans Supabase ni
> YouTube réels. Ajoute des tests couvrant au minimum : chaîne non collectable,
> pagination, dédoublonnage en base et dans le lot, création d'un candidat,
> relance idempotente, règle label/distributeur, réponse partielle, erreur d'une
> chaîne sans arrêt global, annulation/perte de lease via `assertActive`, et
> absence de données sensibles dans le journal.
>
> Ne développe pas K5 (snapshots/calcul du brouillon), K6 (routes), K7
> (publication), l'interface, ni les formulaires D10. N'applique aucune
> migration sur Supabase hébergé. Si le schéma K1 est réellement insuffisant,
> arrête-toi et explique précisément le champ ou la contrainte manquante avant
> de créer une migration.
>
> Exécute les tests, TypeScript, ESLint sans avertissement et le build. Ne coche
> K4 qu'après réussite. Arrête-toi ensuite et fournis la liste exacte des
> fichiers modifiés et des contrôles exécutés.

## Prompt K5 minimal pour Kiro

> Lis `.kiro/steering/*`, le cahier des charges YouTube joint au projet, puis
> `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`. K1 à K4 sont
> terminées et vérifiées. Exécute uniquement K5 : rafraîchissement des vidéos
> suivies, snapshots immuables, calcul hebdomadaire par chanson et création
> transactionnelle d'un Top 20 brouillon.
>
> Réutilise obligatoirement :
>
> - `api-client.ts` pour `videos.list` par lots de 50 maximum ;
> - `orchestrator.ts` et `ctx.assertActive()` avant chaque lot, puis juste avant
>   toute persistance ;
> - `ranking.ts` pour calculer, agréger et trier ;
> - les tables K1 `youtube_videos`, `youtube_track_assets`,
>   `youtube_metric_snapshots`, `chart_editions` et `chart_entries` ;
> - la source `youtube_hmi_weekly_delta` et le `sync_run_id` K3.
>
> Ne collecte que les vidéos actives, approuvées et éligibles associées à une
> chanson. Exclue les Shorts et les types non éligibles. Une même vidéo ne doit
> être comptée qu'une fois, même si des références redondantes existent.
> `youtube_track_assets` est la source canonique de l'association
> chanson–vidéo ; documente clairement tout fallback éventuellement nécessaire.
>
> Pour chaque vidéo, crée au maximum un snapshot immuable par exécution. Une
> reprise avec le même `sync_run_id` doit retourner le snapshot existant sans
> l'écraser. Stocke les compteurs originaux, l'heure observée, la disponibilité,
> la source et l'erreur éventuelle. Une vidéo privée, supprimée ou indisponible
> conserve son historique et son association ; elle produit un avertissement et
> ne doit pas faire échouer les autres vidéos. Ne remplace jamais une métrique
> source par une valeur corrigée.
>
> Pour la période demandée :
>
> - utilise comme départ le dernier snapshot valable à la borne de début ;
> - utilise comme fin le dernier snapshot valable à la borne de fin ;
> - une vidéo publiée pendant la période peut utiliser zéro comme départ ;
> - une ancienne vidéo sans snapshot de départ est exclue pour cette période ;
> - une absence de snapshot de fin est une anomalie ;
> - une diminution de compteur est une anomalie, jamais un delta négatif
>   automatiquement accepté.
>
> Agrège les deltas de toutes les vidéos éligibles par `track_id`, puis trie par
> nouvelles vues, nouveaux likes, nouveaux commentaires, vues totales et date
> de sortie. Aucun score composite. Conserve les 20 premières chansons.
>
> Crée ou remplace atomiquement le brouillon correspondant à
> `(chart_source_id, period_start, period_end)` : l'édition, ses entrées et son
> `entry_count` doivent être validés dans une seule transaction. Une erreur doit
> tout annuler. Ne modifie jamais une édition `published` et ne publie rien.
> Utilise les statuts existants en minuscules (`draft` ou `needs_review`).
> Renseigne au minimum les positions automatiques, `metric_value`,
> `metric_unit='views'`, `delta_views`, `delta_likes`, `delta_comments`,
> `track_id`, titre/artiste sources et les données nécessaires à la future
> prévisualisation.
>
> La transaction doit être fencée : le SQL reçoit source, période,
> `owner_token` et `sync_run_id`, verrouille/vérifie le lease K3 encore actif,
> non expiré et appartenant au run avant d'insérer les snapshots ou de remplacer
> le brouillon. Une ancienne instance ayant perdu son lease ne doit pouvoir
> écrire aucune donnée K5. Préfère une fonction PostgreSQL
> `SECURITY INVOKER`, avec `search_path` fixé, `REVOKE EXECUTE` pour
> `PUBLIC/anon/authenticated` et `GRANT` uniquement à `service_role`.
>
> Inspecte d'abord le schéma réel. Si les colonnes actuelles ne suffisent pas
> pour conserver les bornes de métriques ou garantir l'atomicité, crée une
> migration minimale avec `supabase migration new`; applique-la et teste-la
> uniquement sur Supabase local. Ne l'applique pas sur Supabase hébergé.
>
> Ajoute des services et stockages injectables ainsi que des tests couvrant au
> minimum : lots 50+25, snapshot créé, reprise idempotente, snapshot immuable,
> plusieurs vidéos agrégées sur une chanson, vidéo publiée pendant la période,
> ancienne vidéo sans départ, fin manquante, compteur diminué, vidéo
> indisponible, égalités de classement, moins de 20 chansons, remplacement
> atomique d'un brouillon, refus d'une édition publiée, rollback sur erreur,
> écriture refusée après perte du lease et deux tentatives concurrentes.
> Les tests SQL d'atomicité/fencing doivent utiliser PostgreSQL local réel ;
> des mocks TypeScript seuls ne suffisent pas.
>
> Ne développe pas K6 (routes), K7 (publication/restauration), K8
> (validation finale), l'interface ni les formulaires D10. Aucun secret, réponse
> API brute complète ou description ne doit entrer dans les logs ou
> `sync_runs.metadata`.
>
> Exécute les tests complets, TypeScript, ESLint sans avertissement, le build,
> `supabase db lint --local` et les Security Advisors. Ne coche K5 qu'après
> réussite de tous les contrôles et du test PostgreSQL réel. Arrête-toi ensuite
> et fournis les fichiers modifiés, la migration locale non appliquée sur
> Supabase hébergé et les résultats exacts.

## Prompt de correction K5 v2 pour Kiro

> Reprends uniquement K5. Ne commence ni K6, ni K7, ni K8. La migration
> `20260725183534_youtube_fenced_draft.sql` est appliquée seulement en local et
> reste absente de Supabase hébergé.
>
> Les tests unitaires actuels passent, mais K5 n'est pas intégrable ni
> suffisamment fencée. Corrige tous les points suivants :
>
> 1. `snapshot-storage.ts` ne contient qu'une interface. Implémente un véritable
>    adaptateur Supabase serveur et teste ses requêtes : vidéos éligibles via
>    `youtube_track_assets`, snapshots du run, snapshots aux bornes, métadonnées
>    des chansons, insertion fencée et RPC du brouillon.
> 2. `SnapshotStepConfig.ownerToken` est impossible à fournir correctement :
>    K3 génère son token en privé. Ajoute le token du lease au `StepContext`
>    serveur (ou un mécanisme équivalent sûr), initialise-le depuis
>    l'orchestrateur K3, ne le journalise jamais, puis utilise ce token dans K5.
> 3. Les snapshots sont actuellement insérés hors fencing. Ajoute une fonction
>    SQL d'insertion de snapshots par lot qui vérifie dans la même transaction
>    source, période, owner, expiration, libération et `sync_run_id`, puis fait
>    `INSERT ... ON CONFLICT DO NOTHING`. Une ancienne instance ne doit pouvoir
>    écrire aucun snapshot.
> 4. Le calcul de fin appelle actuellement
>    `getLatestSnapshotsAfter(videoIds, periodStart)`. Remplace-le par une
>    sélection bornée : dernier snapshot observé dans la période et jamais après
>    `periodEnd`. Ajoute un test prouvant qu'un snapshot futur est ignoré.
> 5. Une vidéo indisponible ne doit pas recevoir artificiellement
>    `view_count=0`. Conserve les derniers compteurs connus dans le snapshot
>    d'indisponibilité, marque sa disponibilité, puis exclus-la du calcul avec
>    l'avertissement approprié. Ne la transforme pas en faux
>    `COUNTER_DECREASED`.
> 6. Propage `CancellationRequestedError` comme `LeaseLostError`. Ne la convertis
>    pas en avertissement de lot. Expurge réellement les clés, paramètres
>    `key/api_key/access_token` et tokens Bearer des messages ; une simple
>    troncation ne suffit pas. Signale aussi les IDs invalides.
> 7. Le brouillon SQL est toujours `draft`. Calcule et passe explicitement
>    `draft` ou `needs_review`. Les snapshots manquants, compteurs diminués,
>    indisponibilités et autres anomalies doivent produire `needs_review`.
>    Conserve un résumé non sensible dans `validation_notes`.
> 8. Conserve dans `chart_entries` au minimum `total_views` et
>    `eligible_video_count`, en plus des deltas et de `metric_value`, afin que la
>    prévisualisation future n'ait pas à recalculer les données historiques.
>    Ajoute ces colonnes dans la migration K5 si elles manquent.
> 9. Renforce `fenced_upsert_youtube_draft` : valide les paramètres, exige un
>    tableau JSON, vérifie que `p_chart_source_id` correspond à
>    `p_source_key`, et que `p_period_start/p_period_end` correspondent exactement
>    à `p_period_key`. Le test local a prouvé qu'un lease de février accepte
>    actuellement un brouillon de mars.
> 10. Sérialise deux écritures concurrentes du même brouillon. Deux sessions
>     valides ne doivent créer qu'une édition et un seul ensemble d'entrées.
>     Un ancien propriétaire doit être rejeté.
>
> Corrige la migration K5 existante puisqu'elle n'est pas déployée, puis rejoue
> les migrations sur Supabase local. Ne touche pas Supabase hébergé.
>
> Les tests PostgreSQL réels doivent vérifier, avec transactions et nettoyage :
>
> - insertion de snapshots avec lease valide ;
> - refus des snapshots avec mauvais owner, lease expiré ou libéré ;
> - refus source/période incohérentes ;
> - deux écritures concurrentes donnant une seule édition cohérente ;
> - refus d'une édition publiée ;
> - rollback conservant l'ancien brouillon si une entrée est invalide ;
> - privilèges : aucune exécution `PUBLIC/anon/authenticated`, uniquement
>   `service_role`.
>
> Les tests TypeScript doivent utiliser l'adaptateur Supabase simulé en plus des
> services injectables et vérifier les arguments RPC exacts. Ne présente plus un
> mock séquentiel comme un test de concurrence PostgreSQL.
>
> Exécute la suite complète, TypeScript, ESLint sans avertissement, le build,
> `supabase db lint --local`, les Security Advisors et tous les scénarios SQL
> réels. Ne coche K5 qu'après réussite. Arrête-toi et fournis les fichiers
> modifiés ainsi que les résultats exacts.
