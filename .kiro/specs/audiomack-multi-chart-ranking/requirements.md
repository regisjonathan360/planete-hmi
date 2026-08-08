# Requirements Document

## Introduction

Ce module étend le système de classements Audiomack existant de Planète HMI pour prendre en charge la **collecte multi-genres**, la **fusion pondérée** de classements en un classement composite « Best Of Audiomack Haiti », l'**affichage limité au Top 20**, la **prévisualisation audio au survol** via l'embed Audiomack, l'**extraction de statistiques réelles** (écoutes, likes, reposts) depuis les pages Audiomack, et le **reclassement automatique** basé sur ces métriques. L'objectif est d'enrichir l'expérience visiteur en présentant un classement transversal calculé à partir de plusieurs sources de genre, tout en offrant à l'administrateur un contrôle fin sur la sélection des genres, la pondération, l'analyse statistique et la publication.

Le système existant collecte déjà le « Weekly 100 Haiti » (genre `all`) via Playwright et dispose de 15 sources de genre définies dans `chart_sources`. Ce module active la collecte effective de genres multiples, ajoute l'algorithme de fusion, introduit la prévisualisation audio intégrée, et limite l'affichage public au Top 20.

## Glossary

- **Systeme**: L'application Next.js, le backend Supabase et les scripts de collecte implémentant ce module.
- **Collecteur**: Le script Playwright (GitHub Actions ou déclenchement admin) qui scrape les données de classement Audiomack.
- **Source_Genre**: Une source de classement Audiomack par genre (ex. `audiomack_haiti_top_songs_caribbean`), déjà enregistrée dans `chart_sources`.
- **Classement_Composite**: Un classement calculé par fusion pondérée de plusieurs Sources_Genre, identifié par la source_key `audiomack_haiti_composite`.
- **Poids_Genre**: Le coefficient numérique (0.0 à 5.0) attribué à une Source_Genre pour le calcul du Classement_Composite.
- **Score_Composite**: Le score calculé pour une chanson dans le Classement_Composite, résultant de la somme pondérée inversée de ses positions dans les Sources_Genre.
- **Embed_Audiomack**: L'iframe Audiomack au format `https://audiomack.com/embed/song/{artistSlug}/{trackSlug}` permettant la lecture audio.
- **Previsualisation**: Le lecteur audio intégré affiché au survol (desktop) ou au tap (mobile) d'une entrée de classement.
- **Administrateur**: Un utilisateur authentifié disposant du rôle administrateur dans Supabase.
- **Edition**: Une occurrence hebdomadaire d'un classement pour une période donnée, passant par les statuts `draft` → `validated` → `published`.
- **Entree**: Une ligne d'une Edition reliant une chanson à une position.
- **Position_Source**: La position d'origine dans le classement Audiomack du genre correspondant.
- **Position_Filtree**: La position 1..20 attribuée après filtrage des artistes haïtiens vérifiés.
- **Top_20**: Le nombre maximum d'entrées affichées publiquement par classement.
- **Stats_Extraction**: Le processus de récupération des métriques réelles (écoutes, likes, reposts) depuis les pages Audiomack des chansons collectées.
- **Score_Stats**: Le score calculé pour une chanson à partir de ses métriques réelles : formule pondérée combinant écoutes, likes et reposts.
- **Reclassement**: L'action de recalculer les positions d'un classement en utilisant les Score_Stats au lieu des positions source d'origine.

## Requirements

### Requirement 1: Collecte multi-genres via Playwright

**User Story:** En tant qu'administrateur, je veux collecter les classements de plusieurs genres Audiomack Haiti séparément, afin de disposer de données granulaires par genre pour alimenter le classement composite.

#### Acceptance Criteria

1. WHEN l'Administrateur déclenche une collecte multi-genres, THE Collecteur SHALL scraper séquentiellement chaque Source_Genre activée depuis la page Audiomack correspondante.
2. THE Collecteur SHALL collecter les 100 premières entrées de chaque Source_Genre activée, en utilisant le même mécanisme de scraping que le « Weekly 100 » existant.
3. WHEN une Source_Genre échoue pendant la collecte, THE Collecteur SHALL continuer la collecte des autres Sources_Genre et enregistrer l'erreur.
4. THE Systeme SHALL stocker les résultats de chaque Source_Genre dans une Edition distincte avec sa propre `source_key`.
5. THE Collecteur SHALL accepter un paramètre `genres` (liste de `genreId`) pour limiter la collecte à un sous-ensemble de genres.
6. THE Systeme SHALL supporter la collecte automatique multi-genres via le workflow GitHub Actions existant (déclenchement planifié ou manuel).

### Requirement 2: Sélection et activation des genres

**User Story:** En tant qu'administrateur, je veux choisir quels genres Audiomack sont collectés et inclus dans le calcul composite, afin de ne pas polluer le classement avec des genres non pertinents.

#### Acceptance Criteria

1. THE Systeme SHALL permettre à l'Administrateur d'activer ou désactiver chaque Source_Genre individuellement via l'interface d'administration.
2. THE Systeme SHALL fournir un état `is_enabled` par Source_Genre dans la table `chart_sources`, contrôlant à la fois la collecte et l'inclusion dans le Classement_Composite.
3. WHERE une Source_Genre est désactivée, THE Collecteur SHALL ignorer cette source lors de la collecte automatique.
4. THE Systeme SHALL activer par défaut les genres suivants : `all`, `afrosounds`, `hip-hop-rap`, `caribbean`, `latin`, `r-b`, `gospel`, `pop`.
5. WHERE une Source_Genre est désactivée après avoir été incluse dans un Classement_Composite publié, THE Systeme SHALL conserver les Editions historiques sans les modifier.

### Requirement 3: Configuration de la pondération

**User Story:** En tant qu'administrateur, je veux définir le poids de chaque genre dans le calcul du classement composite, afin d'ajuster l'importance relative des genres selon la pertinence culturelle.

#### Acceptance Criteria

1. THE Systeme SHALL stocker un Poids_Genre configurable (nombre décimal de 0.0 à 5.0) pour chaque Source_Genre.
2. THE Systeme SHALL appliquer un Poids_Genre par défaut de 1.0 à toute Source_Genre nouvellement activée.
3. WHEN l'Administrateur modifie un Poids_Genre, THE Systeme SHALL sauvegarder la modification et recalculer la prévisualisation du Classement_Composite.
4. THE Systeme SHALL permettre un Poids_Genre de 0.0, excluant la Source_Genre du calcul composite tout en conservant sa collecte.
5. THE Systeme SHALL afficher à l'Administrateur un récapitulatif des poids normalisés (pourcentage de contribution de chaque genre).

### Requirement 4: Algorithme de fusion pondérée (Classement Composite)

**User Story:** En tant que visiteur, je veux consulter un classement « Best Of » qui combine intelligemment les classements de plusieurs genres, afin d'avoir une vue transversale de la musique haïtienne populaire sur Audiomack.

#### Acceptance Criteria

1. THE Systeme SHALL calculer le Score_Composite d'une chanson comme la somme des contributions de chaque Source_Genre où elle apparaît : `score = Σ (Poids_Genre × (101 − Position_Source))` pour chaque genre où la chanson est présente.
2. THE Systeme SHALL trier les chansons par Score_Composite décroissant pour établir le Classement_Composite.
3. WHERE deux chansons ont un Score_Composite identique, THE Systeme SHALL départager par le nombre de genres où la chanson apparaît (décroissant), puis par la meilleure Position_Source (croissante).
4. THE Systeme SHALL limiter le Classement_Composite à 20 entrées maximum.
5. THE Systeme SHALL inclure dans le calcul uniquement les Sources_Genre dont l'Edition la plus récente a le statut `published` et dont le Poids_Genre est supérieur à 0.
6. WHEN une Source_Genre n'a pas d'Edition publiée pour la période courante, THE Systeme SHALL exclure cette source du calcul sans bloquer la génération du Classement_Composite.
7. THE Systeme SHALL conserver pour chaque Entree du Classement_Composite la liste des genres contributeurs avec leur position et leur poids respectif.

### Requirement 5: Limitation de l'affichage au Top 20

**User Story:** En tant que visiteur, je veux voir un classement concis limité à 20 titres par genre et pour le composite, afin de consulter rapidement les meilleures chansons sans être submergé.

#### Acceptance Criteria

1. THE Systeme SHALL afficher un maximum de 20 entrées sur la page publique de chaque classement Audiomack (genre individuel et composite).
2. THE Systeme SHALL continuer à collecter 100 entrées par Source_Genre pour alimenter le calcul composite.
3. THE Systeme SHALL calculer la Position_Filtree de 1 à 20 après le filtrage des artistes haïtiens vérifiés.
4. WHERE moins de 20 chansons admissibles sont trouvées après filtrage, THE Systeme SHALL afficher uniquement les chansons admissibles sans compléter artificiellement.
5. THE Systeme SHALL conserver dans la base de données toutes les entrées collectées (jusqu'à 100), indépendamment de la limite d'affichage.

### Requirement 6: Prévisualisation audio au survol (Embed Audiomack)

**User Story:** En tant que visiteur, je veux écouter un extrait d'une chanson en survolant son entrée dans le classement, afin de découvrir la musique directement depuis la page sans quitter le site.

#### Acceptance Criteria

1. WHEN un visiteur survole une Entree de classement sur desktop pendant plus de 300ms, THE Systeme SHALL afficher une Previsualisation contenant l'Embed_Audiomack de la chanson.
2. WHEN un visiteur tape sur une Entree de classement sur mobile, THE Systeme SHALL afficher la Previsualisation en panneau glissant (bottom sheet).
3. THE Systeme SHALL construire l'URL de l'Embed_Audiomack au format `https://audiomack.com/embed/song/{artistSlug}/{trackSlug}`.
4. THE Systeme SHALL extraire les `artistSlug` et `trackSlug` depuis le champ `sourceTrackUrl` stocké lors de la collecte.
5. IF le `sourceTrackUrl` d'une Entree est absent ou invalide, THEN THE Systeme SHALL ne pas afficher la Previsualisation et afficher un lien externe vers la page Audiomack à la place.
6. THE Systeme SHALL dimensionner l'iframe Embed_Audiomack à une hauteur de 110px (format compact) et une largeur de 100% du conteneur parent.
7. WHEN le visiteur quitte la zone de survol (desktop) ou ferme le panneau (mobile), THE Systeme SHALL détruire l'iframe pour libérer les ressources.
8. THE Systeme SHALL limiter à une seule Previsualisation active à la fois sur la page.

### Requirement 7: Pages publiques multi-classements Audiomack

**User Story:** En tant que visiteur, je veux naviguer entre les classements par genre et le classement composite, afin de consulter les tendances par catégorie musicale.

#### Acceptance Criteria

1. THE Systeme SHALL exposer la route `/charts/audiomack` affichant le Classement_Composite en priorité, suivi des classements par genre activés.
2. THE Systeme SHALL permettre la navigation par onglets ou filtres entre le Classement_Composite et chaque genre individuel activé.
3. THE Systeme SHALL afficher pour chaque classement : le nom du genre, la date de mise à jour, le nombre d'entrées et le Top 20 filtré.
4. WHERE un genre activé n'a pas encore d'Edition publiée, THE Systeme SHALL afficher un état vide avec un message explicatif au lieu d'un onglet.
5. THE Systeme SHALL afficher sur chaque Entree : Position_Filtree, pochette, titre, artiste(s), évolution, et un indicateur des genres contributeurs pour le Classement_Composite.

### Requirement 8: Interface d'administration multi-genres

**User Story:** En tant qu'administrateur, je veux gérer la collecte, la pondération et la publication des classements multi-genres depuis une interface unifiée, afin de piloter efficacement le module.

#### Acceptance Criteria

1. THE Systeme SHALL étendre l'AudiomackManager existant avec un panneau de configuration des genres (activation, poids, ordre d'affichage).
2. THE Systeme SHALL permettre à l'Administrateur de déclencher la collecte pour un genre unique ou pour tous les genres activés.
3. THE Systeme SHALL afficher une prévisualisation du Classement_Composite calculé avec les poids courants avant publication.
4. WHEN l'Administrateur modifie les poids, THE Systeme SHALL recalculer en temps réel la prévisualisation du composite sans affecter les Editions publiées.
5. THE Systeme SHALL permettre à l'Administrateur de publier le Classement_Composite indépendamment des classements par genre.
6. THE Systeme SHALL afficher un tableau de bord montrant l'état de chaque Source_Genre : dernière collecte, nombre d'entrées, statut de l'Edition courante.
7. IF l'Administrateur tente de publier le Classement_Composite alors que moins de 3 Sources_Genre ont une Edition publiée pour la période courante, THEN THE Systeme SHALL afficher un avertissement demandant confirmation.

### Requirement 9: Stockage des slugs et données d'embed

**User Story:** En tant que développeur, je veux que les données nécessaires à l'embed soient stockées dès la collecte, afin de pouvoir construire les URLs de prévisualisation sans appel réseau supplémentaire.

#### Acceptance Criteria

1. THE Collecteur SHALL extraire et stocker le `artistSlug` et le `trackSlug` pour chaque entrée collectée.
2. THE Collecteur SHALL dériver les slugs depuis l'URL de la chanson sur Audiomack (champ `url_slug` ou `sourceTrackUrl`).
3. IF le slug ne peut pas être extrait de l'URL, THEN THE Collecteur SHALL générer un slug normalisé à partir du nom d'artiste et du titre.
4. THE Systeme SHALL stocker `artist_slug` et `track_slug` dans la table `chart_entries` ou `platform_tracks`.
5. THE Systeme SHALL valider que la combinaison `artist_slug/track_slug` produit une URL d'embed syntaxiquement correcte avant stockage.

### Requirement 10: Workflow GitHub Actions multi-genres

**User Story:** En tant qu'exploitant, je veux que la collecte automatique du lundi couvre tous les genres activés, afin de disposer de données fraîches pour calculer le composite chaque semaine.

#### Acceptance Criteria

1. THE Systeme SHALL modifier le workflow `audiomack-collect.yml` pour accepter un paramètre `genres` (liste de genreId séparés par des virgules, ou `all` pour tous les genres activés).
2. WHEN le workflow est déclenché en mode planifié (cron), THE Collecteur SHALL collecter tous les genres activés (`is_enabled = true` et `is_automatic = true`).
3. WHEN le workflow est déclenché manuellement, THE Collecteur SHALL accepter un choix de genres spécifiques ou `all`.
4. THE Collecteur SHALL traiter les genres séquentiellement avec un délai configurable entre chaque collecte pour éviter le rate-limiting Audiomack.
5. WHEN la collecte de tous les genres activés est terminée, THE Systeme SHALL déclencher automatiquement le calcul du Classement_Composite en mode brouillon.

### Requirement 11: Performances et chargement

**User Story:** En tant que visiteur, je veux que la page de classement se charge rapidement malgré les multiples genres et l'embed audio, afin d'une expérience fluide.

#### Acceptance Criteria

1. THE Systeme SHALL charger l'iframe Embed_Audiomack uniquement au moment du survol ou du tap, et non au chargement initial de la page.
2. THE Systeme SHALL utiliser le rendu serveur (SSR ou SSG avec revalidation) pour les données de classement publiques.
3. THE Systeme SHALL NOT effectuer d'appel vers Audiomack depuis le navigateur du visiteur pour les données de classement.
4. WHEN le visiteur change d'onglet de genre, THE Systeme SHALL afficher les données en moins de 200ms si elles sont déjà en cache.
5. THE Systeme SHALL précharger les données de l'onglet actif et de l'onglet suivant pour une navigation fluide.

### Requirement 12: Extraction de statistiques des musiques collectées

**User Story:** En tant qu'administrateur, je veux extraire les statistiques réelles (écoutes, likes, reposts) des musiques collectées depuis Audiomack, afin de disposer de métriques objectives pour enrichir le classement.

#### Acceptance Criteria

1. THE Systeme SHALL fournir un bouton « Extraire les stats » dans l'interface d'administration Audiomack.
2. WHEN l'Administrateur clique sur « Extraire les stats », THE Systeme SHALL récupérer les métriques disponibles pour chaque Entree de l'Edition courante depuis la page Audiomack de la chanson (nombre d'écoutes, likes, reposts, commentaires).
3. THE Systeme SHALL stocker les métriques extraites dans le champ `metric_value` de `chart_entries` avec `metric_unit` indiquant le type de métrique (ex: 'plays', 'composite_score').
4. THE Systeme SHALL stocker les métriques détaillées (plays, likes, reposts) dans un champ JSON `metadata` de `chart_entries` ou dans une table dédiée `chart_entry_metrics`.
5. THE Systeme SHALL afficher les statistiques collectées à côté de chaque entrée dans l'admin (nombre d'écoutes formaté, pourcentage de likes).
6. WHEN l'extraction échoue pour une entrée (page indisponible, format changé), THE Systeme SHALL marquer l'entrée comme « stats non disponibles » et continuer l'extraction des autres entrées.
7. THE Systeme SHALL supporter l'extraction en lot (toutes les entrées d'une édition) avec une progression visible pour l'Administrateur.
8. THE Systeme SHALL respecter un délai d'au moins 2 secondes entre chaque requête vers Audiomack pour éviter le blocage.

### Requirement 13: Reclassement automatique basé sur les statistiques

**User Story:** En tant qu'administrateur, je veux un bouton pour recalculer automatiquement le classement en utilisant les statistiques réelles des chansons, afin d'obtenir un classement basé sur la popularité mesurée plutôt que sur la position source.

#### Acceptance Criteria

1. THE Systeme SHALL fournir un bouton « Recalculer par stats » dans l'interface d'administration Audiomack.
2. WHEN l'Administrateur clique sur « Recalculer par stats », THE Systeme SHALL recalculer les positions de toutes les Entrees de l'Edition courante en triant par Score_Stats décroissant.
3. THE Systeme SHALL calculer le Score_Stats d'une chanson avec la formule : `Score_Stats = (plays × 1.0) + (likes × 5.0) + (reposts × 3.0)`, où les coefficients sont configurables par l'Administrateur.
4. WHERE une Entree n'a pas de statistiques extraites, THE Systeme SHALL conserver sa Position_Source comme fallback.
5. THE Systeme SHALL afficher un comparatif avant/après (positions d'origine vs positions recalculées) pour que l'Administrateur puisse valider le reclassement.
6. THE Systeme SHALL permettre à l'Administrateur d'appliquer ou rejeter le reclassement après visualisation du comparatif.
7. WHEN l'Administrateur applique le reclassement, THE Systeme SHALL mettre à jour les `source_position` des Entrees et déclencher un recalcul des positions filtrées.
8. THE Systeme SHALL conserver un historique des reclassements effectués (date, ancien ordre, nouvel ordre) pour audit.
9. THE Systeme SHALL permettre de configurer les coefficients de pondération des métriques (plays, likes, reposts) depuis l'interface admin.

