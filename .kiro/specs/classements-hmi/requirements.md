# Requirements Document

## Introduction

Ce module ajoute à Planète HMI une **page de classements musicaux hebdomadaires** dédiée aux chansons interprétées par des artistes haïtiens vérifiés, réparties sur cinq plateformes (YouTube Music, Spotify, Audiomack, Apple Music, TikTok). Chaque plateforme expose un Top 10 sur la page principale et un Top 20 sur sa page dédiée.

Le principe directeur est **l'intégrité des données** : ne jamais inventer d'API, ne jamais présenter une donnée hors contexte, ne jamais publier de fausse donnée, et distinguer systématiquement la plateforme source, le territoire/contexte mesuré et la méthode de collecte. Tant qu'une plateforme n'offre pas d'accès officiel fiable, la donnée est fournie par **import administratif vérifié**, l'architecture permettant de remplacer chaque import manuel par une API ou un flux partenaire sans modifier la page publique ni reconstruire la base.

### Décision de stack (audit préalable)

L'audit du dépôt établit l'état réel : site **statique HTML/CSS/JS vanilla** hébergé sur GitHub Pages, sans Next.js, React, TypeScript, Vercel, Supabase ni PostgreSQL, sans authentification ni rôles. Le cahier des charges impose ce socle technique. Le module sera donc bâti sur une **nouvelle application Next.js (App Router) + TypeScript**, un backend **Supabase (PostgreSQL, Auth, RLS, Edge Functions, Cron)** et un déploiement **Vercel**, en **portant** le design et le contenu statiques existants sans les supprimer ni casser l'existant durant la transition.

## Glossary

- **Systeme**: L'ensemble de l'application Next.js, du backend Supabase et des fonctions serveur implémentant ce module.
- **Plateforme**: L'une des cinq sources musicales : `youtube`, `spotify`, `audiomack`, `apple_music`, `tiktok`.
- **Classement_Source**: Un classement provenant d'une Plateforme, identifié par un `source_key`, caractérisé par une plateforme, un contexte, un territoire et un mode d'ingestion.
- **Mode_Ingestion**: La méthode d'acquisition d'un Classement_Source : `OFFICIAL_API`, `OFFICIAL_EXPORT`, `VERIFIED_ADMIN_IMPORT`, `PARTNER_FEED` ou `DISABLED`.
- **Edition**: Une occurrence hebdomadaire d'un Classement_Source pour une période donnée (`chart_editions`), passant par des statuts jusqu'à `published`.
- **Entree**: Une ligne d'une Edition (`chart_entries`) reliant une chanson à une position.
- **Position_Source**: La position d'origine de la chanson dans le classement de la Plateforme, jamais modifiée.
- **Position_Filtree**: La position 1..20 attribuée par Planète HMI après filtrage des artistes haïtiens vérifiés.
- **Artiste_Haitien_Verifie**: Un artiste dont `haitian_status` vaut `verified_haitian`, `verified_haitian_diaspora` ou `verified_haitian_group`.
- **Adaptateur**: Un module par Plateforme implémentant l'interface `ChartSourceAdapter` (`testConnection`, `fetchChart`, `normalize`, `validate`).
- **Import_Admin**: Un import administratif vérifié de données de classement (CSV, JSON ou saisie manuelle structurée).
- **File_Correspondance**: La file de vérification humaine des correspondances chanson/plateforme incertaines (`chart_match_queue`).
- **Periode_Canonique**: La semaine Planète HMI, du vendredi 00:00 UTC au jeudi 23:59:59 UTC.
- **Fuseau_Officiel**: Le fuseau IANA `America/Port-au-Prince` utilisé pour l'affichage et la programmation de publication.
- **Administrateur**: Un utilisateur authentifié via Supabase disposant du rôle administrateur.
- **Badge_Methode**: L'indicateur visuel du Mode_Ingestion d'une Edition (API officielle, Import officiel vérifié, Flux partenaire, Mise à jour en attente, Données expérimentales).
- **Edition_Perimee**: Une Edition dont la source n'a pas été actualisée pour la période courante (`is_stale = true`).
- **Existant_Statique**: Le site HTML/CSS/JS actuel et ses fonctionnalités (design cosmique, StageLightsOverlay, previews audio, collecte JSON via GitHub Actions).

## Requirements

### Requirement 1: Décision et mise en place de la stack

**User Story:** En tant que mainteneur, je veux bâtir le module sur Next.js + Supabase + Vercel sans casser le site actuel, afin de satisfaire les critères d'acceptation techniques tout en préservant l'existant.

#### Acceptance Criteria

1. THE Systeme SHALL implémenter le module avec Next.js (App Router) et TypeScript.
2. THE Systeme SHALL stocker les données de classements dans Supabase (PostgreSQL).
3. THE Systeme SHALL fournir des migrations SQL versionnées pour l'ensemble du schéma.
4. THE Systeme SHALL préserver l'Existant_Statique fonctionnel jusqu'à la bascule d'hébergement validée.
5. THE Systeme SHALL produire un build de production Next.js se terminant sans erreur.
6. THE Systeme SHALL typer l'ensemble du code du module.

### Requirement 2: Intégrité des sources (ne jamais inventer d'API)

**User Story:** En tant que responsable éditorial, je veux que le système n'invente jamais de données ni d'endpoint, afin de garantir la fiabilité et la légalité du service.

#### Acceptance Criteria

1. WHERE une Plateforme n'expose pas d'endpoint officiel documenté pour son classement Haïti, THE Systeme SHALL utiliser le Mode_Ingestion `VERIFIED_ADMIN_IMPORT` au lieu d'un endpoint inventé.
2. THE Systeme SHALL NOT contourner une protection, utiliser une URL interne non documentée, ni scraper du HTML sans autorisation.
3. THE Systeme SHALL NOT récupérer, copier ou scraper les données de GlobHaitian.
4. WHEN une fonction de collecte est en mode manuel, THE Systeme SHALL retourner un statut explicite `manual_import_required` sans simuler de succès.
5. THE Systeme SHALL NOT remplacer une donnée réelle manquante par une estimation ou une chanson inventée.

### Requirement 3: Distinction plateforme / contexte / méthode

**User Story:** En tant que visiteur, je veux savoir d'où vient chaque classement et ce qu'il mesure, afin de ne pas être induit en erreur.

#### Acceptance Criteria

1. THE Systeme SHALL afficher pour chaque Classement_Source la Plateforme source, le territoire ou contexte mesuré, et la méthode de collecte.
2. THE Systeme SHALL NOT nommer « officiel YouTube Music Haïti » un classement calculé à partir de vues mondiales sélectionnées.
3. THE Systeme SHALL distinguer visuellement un classement territorial (ex. « Spotify — Populaire en Haïti ») d'un classement international (ex. « Apple Music — HMI Worldwide »).
4. THE Systeme SHALL présenter la métrique TikTok comme un nombre de publications utilisant un son, et NON comme des streams ou des vues.
5. THE Systeme SHALL NOT présenter un classement hebdomadaire global Audiomack comme un classement Haïti.
6. THE Systeme SHALL NOT présenter le classement `mostPopular` de la YouTube Data API comme YouTube Music Charts Haïti.

### Requirement 4: Ne jamais publier de fausses données

**User Story:** En tant que visiteur, je veux que les dates et statuts reflètent la réalité, afin de faire confiance à la fraîcheur des classements.

#### Acceptance Criteria

1. WHEN une Plateforme est indisponible pour la période courante, THE Systeme SHALL conserver la dernière Edition valide et afficher sa date réelle.
2. WHEN une Edition n'a pas été actualisée pour la période courante, THE Systeme SHALL afficher un Badge_Methode « Mise à jour en attente » et marquer l'Edition `is_stale = true`.
3. THE Systeme SHALL NOT dupliquer une ancienne Edition sous une nouvelle date.
4. THE Systeme SHALL NOT afficher « mis à jour aujourd'hui » lorsque la source n'a pas été actualisée.
5. WHEN moins de vingt chansons admissibles sont trouvées, THE Systeme SHALL afficher uniquement les chansons admissibles et indiquer leur nombre, sans compléter artificiellement.

### Requirement 5: Système d'adaptateurs de sources

**User Story:** En tant que développeur, je veux un adaptateur indépendant par plateforme, afin qu'une panne d'une source n'affecte pas les autres.

#### Acceptance Criteria

1. THE Systeme SHALL fournir un Adaptateur distinct par Plateforme implémentant l'interface `ChartSourceAdapter` (`platform`, `ingestionMode`, `testConnection`, `fetchChart`, `normalize`, `validate`).
2. WHEN un Adaptateur échoue, THE Systeme SHALL continuer la collecte et la publication des autres Plateformes.
3. THE Systeme SHALL exposer pour chaque Adaptateur un `Mode_Ingestion` configurable.

### Requirement 6: Registre des artistes haïtiens et éligibilité

**User Story:** En tant que responsable éditorial, je veux un filtrage fondé sur un statut vérifié, afin d'éviter les faux positifs basés sur le nom ou la langue.

#### Acceptance Criteria

1. THE Systeme SHALL stocker pour chaque artiste un `haitian_status` de type énuméré (`verified_haitian`, `verified_haitian_diaspora`, `verified_haitian_group`, `pending_review`, `insufficient_evidence`, `rejected`).
2. WHERE au moins un artiste `primary` ou `co_primary` d'une chanson est un Artiste_Haitien_Verifie, THE Systeme SHALL admettre la chanson dans les classements principaux.
3. WHERE l'unique artiste haïtien d'une chanson a le rôle `featured`, THE Systeme SHALL NOT admettre automatiquement la chanson dans le classement principal.
4. THE Systeme SHALL rendre le critère d'admission configurable, avec une valeur par défaut restrictive.
5. THE Systeme SHALL NOT fonder l'éligibilité uniquement sur le nom, la langue, le genre ou le pays de popularité.

### Requirement 7: Modèle de données

**User Story:** En tant qu'architecte, je veux un schéma complet et contraint, afin de garantir l'intégrité et l'historique des classements.

#### Acceptance Criteria

1. THE Systeme SHALL créer les tables `artists`, `tracks`, `track_artists`, `platform_tracks`, `chart_sources`, `chart_editions`, `chart_entries`, `chart_imports`, `chart_match_queue`, `sync_runs` et `chart_audit_logs`.
2. THE Systeme SHALL appliquer la contrainte `unique(platform, external_id)` sur `platform_tracks`.
3. THE Systeme SHALL appliquer les contraintes `unique(chart_edition_id, track_id)` et `unique(chart_edition_id, filtered_position)` sur `chart_entries`.
4. THE Systeme SHALL appliquer la contrainte `unique(chart_source_id, period_start, period_end)` sur `chart_editions`.
5. THE Systeme SHALL appliquer `unique(isrc)` sur `tracks` lorsque l'ISRC existe.
6. THE Systeme SHALL préparer le schéma pour un futur classement combiné « HMI Multi-Platform Top 100 » sans le publier dans cette version.

### Requirement 8: Identification, déduplication et versions

**User Story:** En tant que responsable qualité, je veux une identification fiable des chansons, afin d'éviter doublons et confusions de versions.

#### Acceptance Criteria

1. THE Systeme SHALL déterminer l'identité d'une chanson selon l'ordre de priorité : ISRC identique, puis identifiant de plateforme déjà associé, puis artiste principal et titre normalisé identiques, puis durée proche, puis date de sortie proche, puis album identique, puis validation humaine.
2. THE Systeme SHALL normaliser un titre en minuscules, accents neutralisés pour la comparaison, espaces réduits, mentions décoratives retirées, tout en conservant les informations musicales significatives (`remix`, `live`, `acoustic`, `sped up`).
3. WHEN la confiance de correspondance est comprise entre 0.95 et 1.00, THE Systeme SHALL établir la correspondance automatiquement.
4. WHEN la confiance de correspondance est inférieure à 0.80, THE Systeme SHALL exiger une vérification humaine via la File_Correspondance.
5. THE Systeme SHALL NOT publier une Entree dont la correspondance est incertaine.
6. THE Systeme SHALL regrouper en famille les versions équivalentes (single/album, vidéo/audio officiels, clean/explicit confirmés) et conserver séparément remix, live, acoustic, sped up, slowed, instrumental, reprise et remaster distinct.

### Requirement 9: Calcul du Top haïtien filtré

**User Story:** En tant que visiteur, je veux un classement haïtien dérivé du classement source sans en altérer les positions d'origine, afin d'avoir une lecture juste.

#### Acceptance Criteria

1. THE Systeme SHALL conserver la Position_Source de chaque Entree sans jamais la modifier.
2. THE Systeme SHALL trier les Entrees admissibles selon la Position_Source croissante puis leur attribuer une Position_Filtree de 1 à 20.
3. THE Systeme SHALL distinguer la Position_Filtree de la Position_Source dans les données et l'affichage.
4. THE Systeme SHALL calculer les mouvements par rapport à la dernière Edition publiée du même Classement_Source.

### Requirement 10: Historique et indicateurs

**User Story:** En tant que visiteur, je veux voir l'évolution des chansons, afin de suivre les tendances.

#### Acceptance Criteria

1. THE Systeme SHALL calculer pour chaque Entree : position actuelle, position précédente, mouvement, meilleure position, semaines totales et semaines consécutives au classement.
2. WHERE une chanson n'a jamais été publiée dans ce Classement_Source, THE Systeme SHALL marquer l'Entree `new`.
3. WHERE une chanson a déjà été classée, a disparu au moins une semaine puis revient, THE Systeme SHALL marquer l'Entree `reentry`.
4. WHEN la position courante est inférieure, égale ou supérieure à la précédente, THE Systeme SHALL marquer respectivement `up`, `stable` ou `down`.
5. THE Systeme SHALL définir la meilleure position comme la plus petite position obtenue sur toutes les Editions publiées du même Classement_Source.

### Requirement 11: Calendrier hebdomadaire et fuseau

**User Story:** En tant qu'exploitant, je veux un cycle hebdomadaire clair en UTC affiché en heure d'Haïti, afin de publier de façon prévisible.

#### Acceptance Criteria

1. THE Systeme SHALL définir la Periode_Canonique du vendredi 00:00 UTC au jeudi 23:59:59 UTC et stocker toutes les dates en UTC.
2. THE Systeme SHALL afficher les horaires dans le Fuseau_Officiel `America/Port-au-Prince`.
3. THE Systeme SHALL utiliser une configuration `publication_day`, `publication_time` et `publication_timezone` (fuseau IANA) sans coder de décalage UTC fixe.
4. WHEN une Edition validée est publiée, THE Systeme SHALL recalculer mouvements, meilleures positions et semaines, puis invalider le cache Next.js.

### Requirement 12: Edge Functions et orchestration

**User Story:** En tant qu'exploitant, je veux une orchestration côté Supabase par petits lots, afin de respecter les limites du plan et d'isoler les échecs.

#### Acceptance Criteria

1. THE Systeme SHALL fournir les Edge Functions `collect-youtube-chart`, `collect-youtube-video-stats`, `collect-spotify-chart`, `collect-audiomack-chart`, `collect-apple-music-chart`, `collect-tiktok-chart`, `process-chart-import`, `normalize-chart-entries`, `match-chart-tracks`, `validate-chart-edition`, `publish-chart-edition`, `retry-failed-chart-runs` et `mark-stale-chart-editions`.
2. THE Systeme SHALL orchestrer la programmation hebdomadaire via Supabase Cron (`pg_cron`/`pg_net`) plutôt que Vercel Cron comme moteur principal.
3. THE Systeme SHALL traiter les données par petits lots pour respecter la durée maximale des Edge Functions.
4. WHEN `collect-spotify-chart`, `collect-audiomack-chart` ou `collect-tiktok-chart` est en mode manuel, THE Systeme SHALL retourner `manual_import_required` sans simuler de succès.

### Requirement 13: Import administratif vérifié

**User Story:** En tant qu'Administrateur, je veux importer et prévisualiser des classements avant publication, afin de garantir des données correctes.

#### Acceptance Criteria

1. THE Systeme SHALL permettre à un Administrateur d'importer un classement au format CSV, JSON ou saisie manuelle structurée.
2. THE Systeme SHALL fournir un template téléchargeable distinct par Plateforme.
3. WHEN un fichier est importé, THE Systeme SHALL afficher une prévisualisation indiquant position source, titre source, artiste source, chanson Planète HMI proposée, niveau de confiance, statut haïtien, erreurs, doublons et changements par rapport à la semaine précédente, avant toute validation.
4. WHERE une entrée importée ne contient pas au minimum `source_position`, `track_title`, `artist_names`, `source_period` et un `source_identifier` ou `source_url`, THE Systeme SHALL rejeter l'entrée.

### Requirement 14: Configuration par plateforme

**User Story:** En tant que responsable éditorial, je veux que chaque plateforme respecte son contexte réel, afin de nommer et mesurer correctement chaque classement.

#### Acceptance Criteria

1. THE Systeme SHALL fournir pour YouTube deux Classements_Source distincts : « YouTube Music — Haïti » (`VERIFIED_ADMIN_IMPORT`) et « YouTube HMI — Vues gagnées en 7 jours » (`OFFICIAL_API`, trié par `weekly_view_delta`).
2. WHERE le mode YouTube automatique est utilisé, THE Systeme SHALL n'inclure que des vidéos officielles validées et exclure réuploads, réactions, contenus de fans et correspondances incertaines.
3. THE Systeme SHALL utiliser pour Spotify le mode `VERIFIED_ADMIN_IMPORT` par défaut et n'utiliser la Web API que pour enrichir (validation Track ID, ISRC, titre, album, artistes, pochette, lien), sans inventer de nombre de streams.
4. THE Systeme SHALL utiliser pour Audiomack le mode `VERIFIED_ADMIN_IMPORT` par défaut, prévoir un mode `PARTNER_FEED` configurable, et NOT renseigner de valeur fictive dans `AUDIOMACK_HAITI_CHART_ENDPOINT`.
5. THE Systeme SHALL utiliser pour Apple Music le mode `OFFICIAL_API`, tester la disponibilité du storefront `ht`, et nommer le classement « Apple Music — Haïti » seulement si `ht` retourne un chart exploitable, sinon « Apple Music — HMI Worldwide », sans bascule silencieuse vers un autre pays.
6. THE Systeme SHALL utiliser pour TikTok le mode `VERIFIED_ADMIN_IMPORT` par défaut, prévoir `PARTNER_FEED` et `OFFICIAL_EXPORT`, et router toute correspondance de son incertaine vers la File_Correspondance.

### Requirement 15: Pages publiques

**User Story:** En tant que visiteur, je veux une page de classements claire et des pages détaillées par plateforme, afin de consulter les Top haïtiens.

#### Acceptance Criteria

1. THE Systeme SHALL exposer les routes publiques `/charts`, `/charts/youtube`, `/charts/spotify`, `/charts/audiomack`, `/charts/apple-music`, `/charts/tiktok` et `/charts/methodology`.
2. THE Systeme SHALL afficher sur `/charts` exactement cinq rangées, dans l'ordre YouTube Music, Spotify, Audiomack, Apple Music, TikTok, chacune limitée à dix chansons avec un bouton « Voir le Top 20 ».
3. THE Systeme SHALL afficher sur chaque page `/charts/{platform}` le Top 20 complet avec position, mouvement, pochette, titre, artiste, Position_Source, meilleure position, semaines au classement, métrique et lien officiel.
4. THE Systeme SHALL afficher chaque rangée avec le nom complet du classement, la description du contexte, la date de mise à jour et un Badge_Methode.
5. WHERE le filtre territorial n'a pas de données réelles, THE Systeme SHALL NOT afficher ce filtre.

### Requirement 16: Page méthodologie

**User Story:** En tant que visiteur, je veux comprendre la méthode de chaque classement, afin de juger de sa fiabilité.

#### Acceptance Criteria

1. THE Systeme SHALL expliquer séparément pour chacune des cinq Plateformes : ce que mesure le classement, la période, le territoire, la métrique, la méthode d'acquisition, les règles d'éligibilité, les limites, la date de dernière collecte et le statut automatique ou manuel.
2. THE Systeme SHALL afficher une déclaration d'indépendance précisant que Planète HMI n'est ni affilié, ni sponsorisé, ni approuvé par les plateformes mentionnées, sauf partenariat explicite.

### Requirement 17: Interface — cartes, responsive, accessibilité, design

**User Story:** En tant que visiteur mobile ou desktop, je veux des cartes lisibles et accessibles réutilisant le design Planète HMI, afin d'une expérience cohérente.

#### Acceptance Criteria

1. THE Systeme SHALL afficher sur chaque carte la Position_Filtree, une pochette carrée, le titre, le ou les artistes, l'évolution, la Position_Source dans les détails, la métrique lorsque fournie, un badge collaboration si nécessaire, et un lien vers la chanson sur la plateforme.
2. THE Systeme SHALL afficher uniquement les métriques réellement fournies par la source utilisée.
3. THE Systeme SHALL placer le numéro de classement Planète HMI à côté de la pochette Spotify et NOT recadrer, couvrir d'un logo ni réutiliser une pochette comme fond graphique.
4. WHERE l'affichage est desktop, THE Systeme SHALL présenter chaque rangée en carrousel horizontal avec navigation et bouton Top 20 visible ; WHERE l'affichage est mobile, THE Systeme SHALL présenter environ 1,3 à 1,7 carte visible en swipe horizontal sans débordement horizontal de la page, avec zones tactiles d'au moins 44px.
5. THE Systeme SHALL transmettre l'évolution par la combinaison d'une icône, d'un texte et d'une couleur, et non par la couleur seule, avec navigation clavier, labels ARIA, contraste suffisant et texte alternatif des pochettes.
6. THE Systeme SHALL réutiliser le design existant, le StageLightsOverlay restant décoratif à faible opacité, `pointer-events: none`, désactivable via `prefers-reduced-motion`, sans obstruer le texte ni ralentir le carrousel.

### Requirement 18: Cache et performances

**User Story:** En tant que visiteur, je veux un chargement rapide sans appels tiers, afin d'une navigation fluide et sûre.

#### Acceptance Criteria

1. THE Systeme SHALL NOT effectuer d'appel direct vers les plateformes depuis le navigateur du visiteur.
2. THE Systeme SHALL lire uniquement les Editions au statut `published` pour l'affichage public.
3. THE Systeme SHALL récupérer les cinq Top 10 via une requête serveur agrégée plutôt que cinq requêtes séquentielles côté navigateur.
4. WHEN une source manque, THE Systeme SHALL afficher un état dédié pour cette rangée sans bloquer le reste de la page, en utilisant des skeletons.
5. THE Systeme SHALL NOT exposer de clé API côté navigateur.

### Requirement 19: Sécurité, RLS et secrets

**User Story:** En tant que responsable sécurité, je veux des accès stricts et des secrets protégés, afin de sécuriser les données et les clés.

#### Acceptance Criteria

1. THE Systeme SHALL autoriser en lecture publique uniquement les artistes, chansons, Editions et Entrees publiés, via des politiques RLS.
2. THE Systeme SHALL restreindre imports, corrections, validation, publication, rollback et gestion des sources aux Administrateurs authentifiés via Supabase.
3. THE Systeme SHALL conserver côté serveur uniquement les secrets (`YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `AUDIOMACK_CONSUMER_KEY`, `AUDIOMACK_CONSUMER_SECRET`, `APPLE_PRIVATE_KEY`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `SUPABASE_SECRET_KEY`).
4. THE Systeme SHALL NOT exposer de secret dans le dépôt, le frontend, les logs publics, les réponses API ni une variable `NEXT_PUBLIC_*`.
5. THE Systeme SHALL protéger les routes `/admin/charts`, `/admin/charts/import`, `/admin/charts/review`, `/admin/charts/sources` et `/admin/charts/history` par authentification et rôle administrateur.

### Requirement 20: Gestion des erreurs et reprises

**User Story:** En tant qu'exploitant, je veux une gestion robuste des erreurs, afin de préserver la dernière donnée valide et d'alerter en cas de panne.

#### Acceptance Criteria

1. THE Systeme SHALL gérer explicitement les statuts 400, 401, 403, 404, 409, 429, 500, 502 et 503.
2. WHEN une erreur 429 ou temporaire survient, THE Systeme SHALL réessayer selon une temporisation croissante (1 min, 5 min, 30 min, 2 h, 12 h) et respecter l'en-tête `Retry-After` s'il est fourni.
3. WHEN plusieurs reprises échouent, THE Systeme SHALL arrêter les répétitions, enregistrer l'erreur, alerter l'administration, conserver la dernière Edition valide et afficher « Mise à jour en attente ».

### Requirement 21: Validation des données

**User Story:** En tant que responsable qualité, je veux une validation stricte, afin d'empêcher la publication d'éditions incohérentes.

#### Acceptance Criteria

1. THE Systeme SHALL valider avec Zod ou équivalent les réponses API, fichiers CSV/JSON, paramètres de routes, données administratives et variables d'environnement.
2. WHERE une Edition contient des positions dupliquées, des chansons dupliquées, une position inférieure à 1, une période incohérente, un artiste non vérifié, une chanson sans correspondance, une source non identifiée, plus de 20 positions filtrées sans raison, ou des données d'une autre semaine, THE Systeme SHALL NOT faire passer l'Edition au statut `validated`.

### Requirement 22: Traçabilité (audit)

**User Story:** En tant que responsable conformité, je veux tracer toutes les actions administratives, afin d'assurer l'auditabilité.

#### Acceptance Criteria

1. WHEN un Administrateur effectue un import, une correction, une validation, une publication ou un rollback, THE Systeme SHALL enregistrer l'action dans `chart_audit_logs` avec `user_id`, `action`, `entity_type`, `entity_id`, ancienne valeur, nouvelle valeur, motif et horodatage.

### Requirement 23: Tests

**User Story:** En tant que mainteneur, je veux une couverture de tests, afin de garantir la non-régression du module.

#### Acceptance Criteria

1. THE Systeme SHALL fournir des tests unitaires pour la normalisation des titres, le calcul des mouvements, les nouvelles entrées et réentrées, la meilleure position, les semaines au classement, le filtrage haïtien, la détection des doublons, la correspondance ISRC, la validation des imports et la gestion des versions.
2. THE Systeme SHALL fournir des tests d'intégration pour la création d'édition, l'import CSV, la correspondance automatique, la validation, la publication, le rollback, la lecture publique, l'échec d'une source et la conservation de la dernière édition.
3. THE Systeme SHALL fournir des tests end-to-end (Playwright) couvrant `/charts`, la présence des cinq rangées, l'ouverture d'un Top 20, le changement de semaine, la navigation mobile, l'état source indisponible, le badge de mise à jour, la protection de l'administration, l'import d'un fichier et la publication.
4. THE Systeme SHALL NOT utiliser de données réelles copiées de GlobHaitian dans les fixtures et SHALL utiliser des données fictives clairement identifiées.

### Requirement 24: Non-régression de l'existant

**User Story:** En tant que mainteneur, je veux que le code hors de ce module ne soit pas cassé, afin de préserver les fonctionnalités actuelles.

#### Acceptance Criteria

1. THE Systeme SHALL préserver les fonctionnalités de l'Existant_Statique (design cosmique, StageLightsOverlay, previews audio, pages actuelles) lors de la migration.
2. THE Systeme SHALL NOT supprimer ni réécrire les fonctionnalités actuelles sans équivalent porté et validé.
3. THE Systeme SHALL permettre de remplacer progressivement chaque Import_Admin par une API ou un flux partenaire sans modifier la page publique ni reconstruire la base de données.
