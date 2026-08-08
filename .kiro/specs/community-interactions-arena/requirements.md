# Requirements Document

## Introduction

Ce module ajoute à Planète HMI une **arène d'interactions communautaires** — un espace dédié où les fans et la communauté peuvent interagir entre eux et avec les artistes haïtiens de la plateforme. L'arène adopte la thématique cosmique du projet (style « arène spatiale ») et propose des mécanismes d'engagement : réactions sur les contenus, commentaires, votes communautaires, défis/battles entre artistes, et un système de réputation gamifié.

L'objectif est de transformer les visiteurs passifs en membres actifs d'une communauté vivante, tout en préservant un environnement respectueux et modéré. L'arène s'intègre dans l'écosystème existant (artistes, classements, districts) et exploite les données de la plateforme (classements, nouveautés) pour alimenter les interactions.

## Glossary

- **Systeme**: L'ensemble de l'application Next.js, du backend Supabase et des composants implémentant le module communautaire.
- **Arene**: L'espace principal d'interactions communautaires accessible depuis la navigation du site.
- **Membre**: Un utilisateur authentifié via Supabase disposant d'un profil communautaire.
- **Artiste**: Un artiste haïtien vérifié présent sur la plateforme Planète HMI.
- **Reaction**: Une réponse rapide (emoji cosmique) qu'un Membre applique à un contenu (chanson, commentaire, battle).
- **Commentaire**: Un message textuel posté par un Membre dans un fil de discussion lié à un contenu ou un événement communautaire.
- **Battle**: Un duel thématique entre deux artistes ou deux chansons soumis au vote de la communauté pendant une durée limitée.
- **Vote**: Le choix d'un Membre en faveur d'un côté d'une Battle.
- **Defi_Communautaire**: Un événement temporaire proposé par l'administration invitant les Membres à participer (écouter, voter, partager) pour gagner des points.
- **Points_Cosmiques**: Les points de réputation accumulés par un Membre via ses interactions (réactions, commentaires, votes, défis).
- **Niveau**: Le grade cosmique d'un Membre déterminé par ses Points_Cosmiques (Étoile, Constellation, Nébuleuse, Galaxie, Univers).
- **Fil_Discussion**: Un ensemble ordonné de Commentaires liés à un sujet (chanson, battle, défi, discussion libre).
- **Moderation**: L'ensemble des règles et outils automatiques et manuels filtrant les contenus inappropriés.
- **Administrateur**: Un utilisateur authentifié via Supabase disposant du rôle administrateur, pouvant gérer battles, défis et modération.
- **Badge**: Une distinction visuelle attribuée à un Membre pour un accomplissement spécifique.
- **Mur_Activite**: Le flux chronologique des interactions récentes visibles dans l'Arène.

## Requirements

### Requirement 1: Accès et navigation de l'Arène

**User Story:** En tant que visiteur, je veux accéder facilement à l'arène communautaire depuis la navigation principale, afin de découvrir et rejoindre les interactions.

#### Acceptance Criteria

1. THE Systeme SHALL exposer la route publique `/arene` accessible via un lien visible dans la navigation principale desktop et dans le menu mobile du site.
2. THE Systeme SHALL afficher l'Arène avec un fond utilisant les couches visuelles cosmiques existantes du site (arrière-plan, étoiles, effets de nébuleuse) telles que définies dans le thème Planète HMI.
3. WHEN un visiteur non authentifié accède à `/arene`, THE Systeme SHALL afficher la liste des interactions sans aucun bouton de création, de vote ou de participation, et SHALL afficher un appel à l'action renvoyant vers `/connexion` indiquant que la connexion est requise pour participer.
4. WHEN un Membre authentifié accède à `/arene`, THE Systeme SHALL afficher l'interface incluant les contrôles de création, de vote et de participation aux interactions.
5. THE Systeme SHALL proposer les sous-routes `/arene/battles`, `/arene/defis`, `/arene/discussions` et `/arene/classement-membres`, chacune accessible via un système d'onglets ou de navigation secondaire visible sur la page Arène.
6. WHEN un visiteur accède à `/arene` sans sous-route spécifique, THE Systeme SHALL afficher par défaut le contenu de la sous-route `/arene/battles`.
7. IF un visiteur accède à une sous-route inexistante sous `/arene`, THEN THE Systeme SHALL rediriger vers `/arene/battles`.

### Requirement 2: Profil communautaire du Membre

**User Story:** En tant que Membre, je veux un profil communautaire affichant mon activité et ma progression, afin de suivre mon engagement.

#### Acceptance Criteria

1. WHEN un utilisateur s'inscrit ou se connecte pour la première fois à l'Arène, THE Systeme SHALL créer un profil communautaire avec un pseudo, un avatar par défaut (thème cosmique) et un Niveau initial « Étoile ».
2. THE Systeme SHALL afficher sur le profil communautaire le pseudo, l'avatar, le Niveau, les Points_Cosmiques, les Badges obtenus, le nombre de commentaires, votes et réactions.
3. THE Systeme SHALL permettre au Membre de modifier son pseudo et son avatar, en acceptant pour l'avatar les formats PNG, JPG et WebP d'une taille maximale de 2 Mo et de dimensions comprises entre 100×100 et 1024×1024 pixels.
4. THE Systeme SHALL valider que le pseudo comporte entre 3 et 30 caractères, ne contient que des lettres, chiffres, tirets et underscores, est unique parmi tous les profils, et ne figure pas dans la liste configurable de termes interdits.
5. IF un Membre tente de choisir un pseudo déjà utilisé, THEN THE Systeme SHALL afficher un message d'erreur indiquant que le pseudo est indisponible et proposer 3 alternatives disponibles basées sur le pseudo saisi.
6. IF un Membre tente de choisir un pseudo contenant un terme interdit ou ne respectant pas les contraintes de format, THEN THE Systeme SHALL rejeter la modification, conserver le pseudo actuel, et afficher un message d'erreur indiquant la règle de validation non respectée.
7. IF un Membre tente de téléverser un avatar dont le format n'est pas supporté ou dont la taille dépasse 2 Mo, THEN THE Systeme SHALL rejeter le fichier, conserver l'avatar actuel, et afficher un message d'erreur indiquant la contrainte non respectée.

### Requirement 3: Système de réactions

**User Story:** En tant que Membre, je veux réagir rapidement aux contenus avec des emojis cosmiques, afin d'exprimer mon appréciation sans écrire un commentaire.

#### Acceptance Criteria

1. THE Systeme SHALL proposer un ensemble de réactions thématiques cosmiques : 🌟 (brillant), 🔥 (feu), 🚀 (décollage), 🪐 (planétaire), 💫 (magique), ❤️ (cœur) sur chaque contenu réactable (chansons, commentaires, battles).
2. WHEN un Membre clique sur une Reaction, THE Systeme SHALL enregistrer la réaction et mettre à jour le compteur affiché en moins de 2 secondes.
3. WHEN un Membre clique à nouveau sur la même Reaction, THE Systeme SHALL retirer sa réaction, décrémenter le compteur, et retirer le Point_Cosmique précédemment attribué pour cette réaction.
4. THE Systeme SHALL limiter chaque Membre à une seule Reaction par type et par contenu.
5. THE Systeme SHALL afficher le nombre total de réactions par type sous chaque contenu réactable (chansons, commentaires, battles).
6. WHEN un Membre pose une Reaction et que son total de Points_Cosmiques gagnés via les réactions pour la journée en cours est inférieur à 50, THE Systeme SHALL attribuer 1 Point_Cosmique au Membre.
7. IF un Membre pose une Reaction et que son total de Points_Cosmiques gagnés via les réactions pour la journée en cours a atteint 50, THEN THE Systeme SHALL enregistrer la réaction sans attribuer de Point_Cosmique.
8. IF un utilisateur non authentifié tente de poser une Reaction, THEN THE Systeme SHALL bloquer l'action et afficher un message invitant l'utilisateur à se connecter.

### Requirement 4: Commentaires et fils de discussion

**User Story:** En tant que Membre, je veux commenter les contenus et participer à des discussions, afin d'échanger avec la communauté.

#### Acceptance Criteria

1. THE Systeme SHALL permettre aux Membres de poster des Commentaires dans un Fil_Discussion lié à une chanson, une Battle, un Defi_Communautaire ou une discussion libre.
2. IF un Membre soumet un Commentaire dont le contenu (après suppression des espaces en début et fin) est vide ou dépasse 500 caractères, THEN THE Systeme SHALL bloquer la publication et afficher un message indiquant la contrainte de longueur (entre 1 et 500 caractères).
3. THE Systeme SHALL afficher les Commentaires par ordre anti-chronologique (du plus récent au plus ancien) avec pagination de 20 commentaires par page.
4. THE Systeme SHALL afficher pour chaque Commentaire le pseudo de l'auteur, son Niveau, la date relative (ex: "il y a 3 min", "il y a 2 h", "il y a 5 j") pour les Commentaires de moins de 7 jours et la date absolue (JJ/MM/AAAA) au-delà, ainsi que les réactions reçues.
5. WHEN un Membre poste un Commentaire, THE Systeme SHALL attribuer 2 Points_Cosmiques au Membre, dans la limite de 20 commentaires comptabilisés par jour calendaire (minuit à minuit, fuseau UTC).
6. IF un Commentaire contient des termes figurant dans la liste de modération, THEN THE Systeme SHALL bloquer la publication et afficher un message invitant le Membre à reformuler.
7. WHEN un Membre supprime l'un de ses propres Commentaires, THE Systeme SHALL retirer le Commentaire de l'affichage du Fil_Discussion et afficher une confirmation de suppression.
8. IF un Membre a atteint la limite de 20 commentaires comptabilisés pour les Points_Cosmiques dans la journée en cours, THEN THE Systeme SHALL toujours permettre la publication du Commentaire mais ne pas attribuer de Points_Cosmiques supplémentaires.

### Requirement 5: Battles communautaires

**User Story:** En tant que Membre, je veux voter dans des battles entre artistes ou chansons, afin de soutenir mes favoris et participer à la vie communautaire.

#### Acceptance Criteria

1. THE Systeme SHALL permettre à un Administrateur de créer une Battle entre deux artistes ou deux chansons avec un titre (maximum 100 caractères), une description (maximum 500 caractères) et une durée parmi 24h, 48h ou 72h.
2. WHILE une Battle est consultable, THE Systeme SHALL afficher les deux côtés présentés côte à côte, une barre de progression des votes mise à jour dans un délai maximum de 5 secondes après chaque vote, et un compte à rebours indiquant le temps restant.
3. WHEN un Membre vote dans une Battle, THE Systeme SHALL enregistrer son Vote de manière définitive (non modifiable, non annulable) et attribuer 3 Points_Cosmiques au Membre.
4. IF un Membre tente de voter dans une Battle dans laquelle il a déjà voté, THEN THE Systeme SHALL rejeter le vote et afficher un message indiquant que le Membre a déjà participé à cette Battle.
5. IF un Membre tente de voter dans une Battle dont le compte à rebours a atteint zéro, THEN THE Systeme SHALL rejeter le vote et afficher un message indiquant que la Battle est terminée.
6. WHEN le compte à rebours d'une Battle atteint zéro, THE Systeme SHALL clôturer les votes, déclarer vainqueur le côté ayant obtenu le plus de votes, et afficher les résultats finaux avec le nombre de votes et le pourcentage de chaque côté.
7. IF les deux côtés d'une Battle terminée ont un nombre de votes identique, THEN THE Systeme SHALL déclarer la Battle comme égalité et afficher les résultats sans vainqueur.
8. THE Systeme SHALL afficher l'historique des Battles terminées avec les résultats, le nombre total de votes et le pourcentage de chaque côté, paginé par groupes de 20 Battles.
9. WHILE une Battle est active, THE Systeme SHALL afficher la Battle dans la première section visible de la page principale de l'Arène.

### Requirement 6: Défis communautaires

**User Story:** En tant que Membre, je veux participer à des défis temporaires, afin de gagner des points bonus et des badges exclusifs.

#### Acceptance Criteria

1. THE Systeme SHALL permettre à un Administrateur de créer un Defi_Communautaire avec un titre (maximum 100 caractères), une description (maximum 500 caractères), des conditions de complétion mesurables, une durée comprise entre 1 heure et 30 jours, et une récompense entre 1 et 10 000 Points_Cosmiques.
2. WHEN un Membre remplit les conditions d'un Defi_Communautaire actif et ne l'a pas déjà complété, THE Systeme SHALL attribuer automatiquement les Points_Cosmiques de récompense et marquer le défi comme complété pour ce Membre, une seule fois par Membre et par défi.
3. THE Systeme SHALL afficher les défis actifs avec leur progression individuelle sous forme de ratio (actions réalisées sur actions requises), le nombre de participants et le temps restant exprimé en jours et heures.
4. WHEN un Defi_Communautaire expire, THE Systeme SHALL clôturer les participations et afficher dans l'historique le statut de complétion de chaque participant ainsi que les Points_Cosmiques attribués.
5. THE Systeme SHALL proposer des types de défis configurables : voter dans N battles, commenter N chansons, réagir à N contenus, participer N jours consécutifs, où N est un entier compris entre 1 et 100 défini par l'Administrateur lors de la création.
6. IF un Membre tente de compléter un Defi_Communautaire qui est expiré ou qu'il a déjà complété, THEN THE Systeme SHALL rejeter l'action et afficher un message indiquant la raison du rejet (défi expiré ou déjà complété).

### Requirement 7: Système de points et niveaux cosmiques

**User Story:** En tant que Membre, je veux accumuler des points et progresser en niveaux, afin d'être reconnu pour mon engagement dans la communauté.

#### Acceptance Criteria

1. THE Systeme SHALL définir les Niveaux cosmiques suivants avec leurs seuils : Étoile (0-99 points), Constellation (100-499), Nébuleuse (500-1499), Galaxie (1500-4999), Univers (5000 et plus, sans limite supérieure).
2. WHEN un Membre atteint le seuil d'un nouveau Niveau, THE Systeme SHALL afficher une notification indiquant le nouveau Niveau atteint et le nom du palier, et mettre à jour le badge de Niveau affiché sur le profil du Membre dans un délai de 5 secondes.
3. THE Systeme SHALL afficher le classement des Membres par Points_Cosmiques sur `/arene/classement-membres`, trié par ordre décroissant de points, avec les 50 premiers Membres, en départageant les ex-aequo par date d'atteinte du score la plus ancienne en premier.
4. THE Systeme SHALL calculer les Points_Cosmiques comme la somme de toutes les actions validées du Membre, sans possibilité de perdre des points acquis.
5. THE Systeme SHALL appliquer les plafonds quotidiens suivants, réinitialisés chaque jour à 00:00 UTC : 50 points maximum via réactions, 40 points maximum via commentaires, et aucun plafond pour les votes et défis.
6. IF un Membre effectue une action dont les points dépasseraient le plafond quotidien de la catégorie concernée, THEN THE Systeme SHALL comptabiliser uniquement les points restants jusqu'au plafond et informer le Membre que le plafond quotidien de cette catégorie est atteint.

### Requirement 8: Badges et accomplissements

**User Story:** En tant que Membre, je veux recevoir des badges pour mes accomplissements, afin d'afficher ma contribution à la communauté.

#### Acceptance Criteria

1. WHEN un Membre atteint l'une des conditions suivantes : premier commentaire publié, premier vote soumis, 10 battles votées, 50 réactions données, 7 jours consécutifs actifs (au moins 1 action parmi commenter, voter ou réagir par période de 24h), complétion d'un défi, ou atteinte d'un nouveau Niveau, THEN THE Systeme SHALL attribuer le Badge correspondant une seule fois par condition remplie, dans un délai de 30 secondes suivant l'action déclencheuse.
2. THE Systeme SHALL afficher les Badges obtenus sur le profil communautaire du Membre avec la date d'obtention.
3. THE Systeme SHALL afficher la liste complète des Badges disponibles avec les conditions d'obtention, en distinguant visuellement les badges obtenus des badges verrouillés.
4. THE Systeme SHALL permettre à un Administrateur de créer des Badges exclusifs liés à des événements spéciaux en renseignant un nom (entre 3 et 50 caractères), une icône, et une condition d'attribution descriptive (entre 10 et 200 caractères).
5. IF un Administrateur soumet un formulaire de création de Badge avec un champ obligatoire manquant ou hors limites, THEN THE Systeme SHALL rejeter la création et afficher un message d'erreur indiquant le champ invalide.
6. WHEN un Badge est attribué à un Membre, THE Systeme SHALL afficher une notification au Membre indiquant le nom du Badge obtenu.

### Requirement 9: Mur d'activité en temps réel

**User Story:** En tant que Membre, je veux voir l'activité récente de la communauté, afin de rester informé et engagé.

#### Acceptance Criteria

1. THE Systeme SHALL afficher sur la page principale de l'Arène un Mur_Activite montrant les dernières interactions (réactions, commentaires, votes, badges obtenus, nouveaux membres), triées de la plus récente à la plus ancienne.
2. THE Systeme SHALL mettre à jour le Mur_Activite sans rechargement de page, via Supabase Realtime, en insérant chaque nouvelle activité en haut de la liste dans un délai maximal de 5 secondes après l'occurrence de l'événement.
3. THE Systeme SHALL limiter le Mur_Activite aux 30 dernières activités avec un bouton « Voir plus » qui charge 30 activités supplémentaires par appui.
4. THE Systeme SHALL afficher chaque activité avec l'auteur (pseudo + niveau), le type d'action, le contenu concerné et la date relative (« il y a X minutes » pour moins de 60 minutes, « il y a X heures » pour moins de 24 heures, « il y a X jours » pour moins de 7 jours, puis la date au format JJ/MM/AAAA au-delà).
5. THE Systeme SHALL regrouper les activités de même type portant sur le même contenu cible survenues dans une fenêtre de 60 minutes (exemple : « 5 membres ont réagi à [chanson] ») pour éviter le spam visuel.
6. IF la connexion Supabase Realtime est perdue, THEN THE Systeme SHALL afficher un indicateur informant le Membre que les mises à jour en temps réel sont interrompues et tenter une reconnexion automatique toutes les 10 secondes jusqu'à 5 tentatives maximum.

### Requirement 10: Modération et sécurité

**User Story:** En tant qu'Administrateur, je veux des outils de modération efficaces, afin de maintenir un environnement communautaire respectueux.

#### Acceptance Criteria

1. WHEN un Membre soumet un Commentaire contenant un ou plusieurs termes présents dans la liste configurable de termes interdits (insultes, discours haineux, spam), THE Systeme SHALL bloquer la publication du Commentaire et afficher un message d'erreur indiquant que le contenu enfreint les règles de la communauté.
2. WHEN un Membre sélectionne l'action de signalement sur un Commentaire, THE Systeme SHALL enregistrer le signalement en associant le Membre signalant, le Commentaire ciblé, et une catégorie de motif choisie parmi : « Insulte », « Spam », « Discours haineux », « Autre ».
3. IF un Membre tente de signaler un Commentaire qu'il a déjà signalé, THEN THE Systeme SHALL rejeter le signalement et afficher un message indiquant que ce Commentaire a déjà été signalé par ce Membre.
4. WHEN un Commentaire atteint 3 signalements ou plus provenant de Membres distincts, THE Systeme SHALL masquer le Commentaire pour tous les utilisateurs non-Administrateurs et le placer en file de modération.
5. THE Systeme SHALL fournir une interface d'administration pour la modération permettant à un Administrateur de valider (rendre visible à nouveau), supprimer définitivement, ou restaurer les Commentaires présents en file de modération.
6. WHEN un Administrateur supprime un Commentaire, THE Systeme SHALL envoyer une notification in-app à l'auteur du Commentaire dans un délai de 60 secondes, incluant le motif de suppression sélectionné par l'Administrateur.
7. IF un Membre accumule 5 suppressions par modération sur une fenêtre glissante de 30 jours, THEN THE Systeme SHALL suspendre la capacité de commenter du Membre pour 7 jours et notifier le Membre de la suspension et de sa date de fin via notification in-app.
8. IF un Membre dépasse la limite de 1 commentaire par 10 secondes ou 10 réactions par 60 secondes, THEN THE Systeme SHALL rejeter l'action excédentaire et afficher un message d'erreur indiquant le temps d'attente restant avant la prochaine action autorisée.
9. THE Systeme SHALL permettre à un Administrateur de modifier la liste de termes interdits utilisée par le filtre automatique, avec un maximum de 500 termes et une longueur maximale de 100 caractères par terme.

### Requirement 11: Responsive et accessibilité

**User Story:** En tant que visiteur mobile ou desktop, je veux une expérience accessible et adaptée à mon appareil, afin de participer confortablement.

#### Acceptance Criteria

1. WHERE l'affichage est mobile (viewport inférieur à 768px), THE Systeme SHALL adapter les cartes de Battle en disposition verticale empilée et les fils de discussion en pleine largeur.
2. WHERE l'affichage est desktop (viewport supérieur ou égal à 768px), THE Systeme SHALL présenter les Battles en disposition face-à-face horizontale et le Mur_Activite en colonne latérale.
3. THE Systeme SHALL fournir des zones tactiles d'au moins 44×44 pixels pour tous les boutons de réaction, de vote, de navigation et d'action interactive.
4. THE Systeme SHALL assurer un ratio de contraste minimum de 4.5:1 pour les textes normaux et 3:1 pour les textes larges (WCAG AA) pour tous les textes affichés sur les fonds cosmiques.
5. THE Systeme SHALL rendre l'interface navigable au clavier avec des indicateurs de focus visibles (outline de 2px minimum avec un contraste suffisant par rapport au fond) et des labels ARIA pour les éléments interactifs.
6. WHEN le navigateur du visiteur signale `prefers-reduced-motion: reduce`, THE Systeme SHALL désactiver les animations cosmiques décoratives (étoiles filantes, effets de nébuleuse animés, particules).

### Requirement 12: Intégration avec l'écosystème existant

**User Story:** En tant que Membre, je veux que l'arène soit connectée aux classements et artistes existants, afin d'interagir dans le contexte musical de la plateforme.

#### Acceptance Criteria

1. THE Systeme SHALL permettre à un Administrateur de créer des Battles liées aux chansons présentes dans les classements de Planète HMI, en sélectionnant les chansons depuis la base existante.
2. THE Systeme SHALL permettre d'ouvrir un Fil_Discussion sur toute chanson figurant dans un classement publié, avec un lien direct depuis la page du classement.
3. THE Systeme SHALL afficher un lien cliquable vers le profil artiste depuis les Battles et les discussions liées à un artiste.
4. WHEN une nouvelle Edition de classement est publiée, THE Systeme SHALL créer automatiquement une entrée dans le Mur_Activite de type « Nouveau classement » incluant le titre de l'édition et un lien vers le classement, dans un délai de 5 minutes suivant la publication.
5. THE Systeme SHALL réutiliser les composants visuels existants (StageLightsBackground, ShootingStars) dans l'Arène en respectant les mêmes paramètres de configuration et le même rendu que sur les autres pages du site.

### Requirement 13: Performances et temps réel

**User Story:** En tant que Membre, je veux des interactions fluides et des mises à jour en temps réel, afin d'une expérience réactive.

#### Acceptance Criteria

1. THE Systeme SHALL utiliser Supabase Realtime pour diffuser les mises à jour de votes, réactions et Mur_Activite sans rechargement de page, avec un délai de propagation maximum de 3 secondes entre l'événement serveur et l'affichage côté client.
2. WHEN le Membre navigue vers une nouvelle page, THE Systeme SHALL fermer toutes les souscriptions Realtime de la page précédente dans un délai de 1 seconde et ouvrir uniquement les souscriptions correspondant aux données affichées sur la page courante, avec un maximum de 5 souscriptions simultanées par client.
3. THE Systeme SHALL paginer les Commentaires et le Mur_Activite côté serveur avec une taille de page par défaut de 20 éléments et un maximum de 50 éléments par requête.
4. THE Systeme SHALL mettre en cache les données de classement des Membres et invalider ce cache dans un délai de 5 secondes suivant chaque changement de points.
5. WHEN un vote est enregistré dans une Battle, THE Systeme SHALL mettre à jour la barre de progression en moins de 2 secondes pour tous les Membres visualisant cette Battle.
6. IF la connexion WebSocket Realtime est perdue, THEN THE Systeme SHALL afficher un indicateur de déconnexion au Membre, tenter une reconnexion automatique toutes les 5 secondes pendant un maximum de 5 tentatives, et restaurer les souscriptions actives lors de la reconnexion réussie.

### Requirement 14: Modèle de données communautaire

**User Story:** En tant qu'architecte, je veux un schéma dédié aux interactions communautaires, afin de structurer les données de manière intègre.

#### Acceptance Criteria

1. THE Systeme SHALL créer les tables `community_profiles`, `reactions`, `comments`, `battles`, `battle_votes`, `challenges`, `challenge_completions`, `badges`, `member_badges`, `activity_feed`, `moderation_reports` et `moderation_actions`, chacune avec une clé primaire UUID et une colonne `created_at` de type timestamptz.
2. THE Systeme SHALL appliquer la contrainte `unique(member_id, content_type, content_id, reaction_type)` sur `reactions`.
3. THE Systeme SHALL appliquer la contrainte `unique(member_id, battle_id)` sur `battle_votes`.
4. THE Systeme SHALL appliquer la contrainte `unique(member_id)` sur `community_profiles`.
5. THE Systeme SHALL appliquer la contrainte `unique(pseudo)` sur `community_profiles`, avec une longueur maximale de 30 caractères pour le champ `pseudo`.
6. THE Systeme SHALL définir des clés étrangères reliant `member_id` à `auth.users(id)` sur les tables `community_profiles`, `reactions`, `comments`, `battle_votes`, `challenge_completions`, `member_badges`, `moderation_reports` et `activity_feed`, avec un comportement `ON DELETE CASCADE`.
7. THE Systeme SHALL activer RLS sur toutes les tables du schéma communautaire et appliquer des politiques autorisant la lecture (SELECT) aux utilisateurs anonymes et authentifiés sur `community_profiles`, `reactions`, `comments` (où `status = 'published'`), `battles`, `battle_votes`, `challenges`, `challenge_completions` et `badges`.
8. IF un utilisateur est authentifié, THEN THE Systeme SHALL autoriser les opérations INSERT, UPDATE et DELETE uniquement sur les lignes où `member_id` correspond à `auth.uid()` dans les tables `community_profiles`, `reactions`, `comments`, `battle_votes` et `challenge_completions`.
9. THE Systeme SHALL fournir des migrations SQL numérotées séquentiellement (préfixe horodaté au format `YYYYMMDDHHMMSS`) pour l'ensemble du schéma communautaire, exécutables dans l'ordre croissant sans erreur sur une base vide.

### Requirement 15: Sécurité et protection des données

**User Story:** En tant que responsable sécurité, je veux protéger les données des membres et prévenir les abus, afin de garantir un environnement sûr.

#### Acceptance Criteria

1. THE Systeme SHALL authentifier les Membres via Supabase Auth avant toute action d'écriture (réaction, commentaire, vote).
2. IF un utilisateur non authentifié ou sans rôle Administrateur tente d'accéder à une route `/admin/arene/*`, THEN THE Systeme SHALL bloquer la requête et retourner une réponse indiquant un accès non autorisé sans révéler l'existence de la ressource.
3. THE Systeme SHALL valider côté serveur toutes les entrées utilisateur avec Zod ou équivalent, en appliquant une longueur maximale de 50 caractères pour les pseudos et de 2000 caractères pour les commentaires.
4. THE Systeme SHALL appliquer un rate-limiting de 60 requêtes par minute par adresse IP et de 30 requêtes d'écriture par minute par Membre.
5. IF un Membre ou une adresse IP dépasse le seuil de rate-limiting, THEN THE Systeme SHALL rejeter les requêtes excédentaires avec une réponse indiquant un dépassement de limite et incluant le délai d'attente avant la prochaine requête autorisée.
6. IF un utilisateur non authentifié tente une action d'écriture (réaction, commentaire, vote), THEN THE Systeme SHALL rejeter la requête avec une réponse indiquant que l'authentification est requise, sans modifier aucune donnée.
7. THE Systeme SHALL NOT exposer les adresses email des Membres dans les réponses API publiques.
8. THE Systeme SHALL NOT stocker de données personnelles au-delà du pseudo, de l'avatar et de l'identifiant d'authentification dans le profil communautaire.
