# Requirements Document

## Introduction

Community Interactions Arena est un ensemble de fonctionnalités sociales et communautaires pour Planète HMI. Il comprend l'amélioration de l'authentification, un système de réactions (Like/Hater), des commentaires structurés par catégories, une section communautaire sur les profils artistes, et surtout l'« Arena des Hits » — une page dédiée aux duels musicaux communautaires avec votes, animations rétro-gaming/cyberpunk, et navigation enchaînée. Le tout s'intègre à l'architecture existante (Next.js 16, React 19, Supabase, CSS pur) sans ajouter de dépendances ni réécrire ce qui fonctionne déjà.

## Glossary

- **Auth_Form**: Le composant d'authentification visiteur (connexion et inscription) existant dans `/connexion`
- **Interaction_Bar**: Composant réutilisable affichant les boutons de réaction (Like, Hater) et le compteur associé pour une entité donnée (artiste, morceau, podium)
- **Comment_Section**: Composant réutilisable affichant les commentaires structurés par catégorie pour une entité donnée
- **Comment_Category**: L'une des quatre catégories de commentaire : Love (❤️), Hype (🔥), Avis (💬), Hater (💀)
- **Arena**: La page dédiée aux duels musicaux communautaires, accessible via la route `/arena`
- **Duel**: Un affrontement entre deux morceaux soumis au vote de la communauté, avec un début, une durée et un résultat
- **Duel_Card**: Composant d'affichage d'un duel montrant les deux morceaux face à face avec artwork, pourcentages et compteurs
- **Vote**: L'action d'un utilisateur authentifié choisissant un morceau dans un duel actif
- **Moderation_Queue**: File d'attente des contenus soumis par les utilisateurs (commentaires, duels proposés) en attente de validation par un administrateur
- **RLS**: Row Level Security de Supabase, politique de sécurité au niveau des lignes de la base de données
- **Registered_User**: Utilisateur ayant un compte vérifié sur Planète HMI
- **Admin_User**: Utilisateur disposant du rôle administrateur dans le système
- **Target_Entity**: Entité pouvant recevoir des réactions ou commentaires (artiste, morceau, classement, duel)
- **Password_Strength_Indicator**: Indicateur visuel de la robustesse du mot de passe pendant la saisie

## Requirements

### Requirement 1: Amélioration du formulaire d'authentification — Visibilité du mot de passe

**User Story:** En tant qu'utilisateur, je veux pouvoir afficher ou masquer mon mot de passe pendant la saisie, afin de vérifier ce que je tape sans erreur.

#### Acceptance Criteria

1. WHEN le Registered_User clique sur le bouton d'affichage du mot de passe, THE Auth_Form SHALL basculer le champ entre le type "password" et le type "text"
2. THE Auth_Form SHALL afficher une icône œil ouvert lorsque le mot de passe est visible et une icône œil fermé lorsque le mot de passe est masqué
3. THE Auth_Form SHALL masquer le mot de passe par défaut au chargement du formulaire

### Requirement 2: Amélioration du formulaire d'authentification — Confirmation du mot de passe

**User Story:** En tant qu'utilisateur créant un compte, je veux confirmer mon mot de passe, afin d'éviter les erreurs de saisie à l'inscription.

#### Acceptance Criteria

1. WHILE le Auth_Form est en mode inscription, THE Auth_Form SHALL afficher un champ de confirmation du mot de passe
2. WHEN les deux champs de mot de passe ne correspondent pas, THE Auth_Form SHALL afficher un message d'erreur indiquant la non-correspondance et désactiver le bouton de soumission
3. WHEN les deux champs de mot de passe correspondent, THE Auth_Form SHALL activer le bouton de soumission

### Requirement 3: Amélioration du formulaire d'authentification — Indicateur de force du mot de passe

**User Story:** En tant qu'utilisateur, je veux voir un indicateur de force de mon mot de passe, afin de choisir un mot de passe suffisamment robuste.

#### Acceptance Criteria

1. WHILE le Auth_Form est en mode inscription, THE Password_Strength_Indicator SHALL afficher une barre de progression indiquant la force du mot de passe (faible, moyen, fort)
2. THE Password_Strength_Indicator SHALL évaluer la force en se basant sur la longueur (minimum 6 caractères), la présence de majuscules, de chiffres et de caractères spéciaux
3. THE Password_Strength_Indicator SHALL mettre à jour visuellement la barre à chaque modification du champ mot de passe

### Requirement 4: Amélioration du formulaire d'authentification — Mot de passe oublié

**User Story:** En tant qu'utilisateur, je veux pouvoir réinitialiser mon mot de passe depuis la page de connexion, afin de récupérer l'accès à mon compte.

#### Acceptance Criteria

1. WHILE le Auth_Form est en mode connexion, THE Auth_Form SHALL afficher un lien "Mot de passe oublié"
2. WHEN le Registered_User clique sur le lien "Mot de passe oublié", THE Auth_Form SHALL afficher un champ email et un bouton d'envoi de réinitialisation
3. WHEN le Registered_User soumet une adresse email valide pour réinitialisation, THE Auth_Form SHALL envoyer un email de réinitialisation via Supabase Auth et afficher un message de confirmation
4. IF l'envoi de l'email de réinitialisation échoue, THEN THE Auth_Form SHALL afficher un message d'erreur descriptif

### Requirement 5: Amélioration du formulaire d'authentification — États de chargement

**User Story:** En tant qu'utilisateur, je veux voir un retour visuel pendant les opérations d'authentification, afin de savoir que ma demande est en cours de traitement.

#### Acceptance Criteria

1. WHILE une opération d'authentification est en cours, THE Auth_Form SHALL afficher un indicateur de chargement sur le bouton de soumission
2. WHILE une opération d'authentification est en cours, THE Auth_Form SHALL désactiver tous les champs et boutons du formulaire
3. WHEN l'opération d'authentification se termine avec succès, THE Auth_Form SHALL restaurer l'état interactif du formulaire

### Requirement 6: Système de réactions — Composant Interaction_Bar

**User Story:** En tant qu'utilisateur authentifié, je veux pouvoir réagir (Like ou Hater) sur les artistes, morceaux, podiums et classements, afin d'exprimer mon appréciation communautaire.

#### Acceptance Criteria

1. THE Interaction_Bar SHALL afficher un bouton Like (🔥) et un bouton Hater (💀) avec leurs compteurs respectifs pour la Target_Entity associée
2. WHEN un Registered_User clique sur le bouton Like, THE Interaction_Bar SHALL enregistrer la réaction en base de données et incrémenter le compteur de 1
3. WHEN un Registered_User clique sur le bouton Hater, THE Interaction_Bar SHALL enregistrer la réaction en base de données et incrémenter le compteur de 1
4. WHEN un Registered_User clique à nouveau sur une réaction déjà enregistrée, THE Interaction_Bar SHALL retirer la réaction et décrémenter le compteur de 1
5. WHEN un Registered_User possède une réaction Like active et clique sur Hater, THE Interaction_Bar SHALL retirer le Like, décrémenter son compteur de 1, enregistrer le Hater et incrémenter son compteur de 1
6. IF un utilisateur non authentifié clique sur un bouton de réaction, THEN THE Interaction_Bar SHALL rediriger vers la page de connexion avec le chemin de retour en paramètre
7. THE Interaction_Bar SHALL être réutilisable pour tout type de Target_Entity (artiste, morceau, classement, duel)

### Requirement 7: Commentaires structurés — Composant Comment_Section

**User Story:** En tant qu'utilisateur authentifié, je veux pouvoir laisser un commentaire catégorisé sur un artiste ou un contenu, afin de partager mon avis avec la communauté.

#### Acceptance Criteria

1. THE Comment_Section SHALL afficher les commentaires groupés par Comment_Category (Love ❤️, Hype 🔥, Avis 💬, Hater 💀)
2. THE Comment_Section SHALL permettre le filtrage des commentaires par Comment_Category via des boutons de filtre
3. WHEN un Registered_User soumet un commentaire, THE Comment_Section SHALL enregistrer le commentaire avec la catégorie sélectionnée, l'identifiant utilisateur et l'horodatage
4. THE Comment_Section SHALL limiter la longueur d'un commentaire à 500 caractères
5. WHEN un commentaire est soumis, THE Comment_Section SHALL placer le commentaire en statut "en attente de modération" avant affichage public
6. IF un utilisateur non authentifié tente de commenter, THEN THE Comment_Section SHALL rediriger vers la page de connexion avec le chemin de retour en paramètre
7. THE Comment_Section SHALL afficher le nombre total de commentaires par catégorie à côté de chaque filtre

### Requirement 8: Modération des commentaires

**User Story:** En tant qu'administrateur, je veux pouvoir modérer les commentaires soumis par la communauté, afin de maintenir un environnement respectueux.

#### Acceptance Criteria

1. THE Moderation_Queue SHALL être accessible depuis le panneau d'administration existant
2. WHEN un Admin_User approuve un commentaire, THE Moderation_Queue SHALL mettre à jour le statut du commentaire à "approuvé" et le rendre visible publiquement
3. WHEN un Admin_User rejette un commentaire, THE Moderation_Queue SHALL mettre à jour le statut du commentaire à "rejeté" et le masquer définitivement
4. THE Moderation_Queue SHALL afficher l'auteur, la catégorie, le contenu, la cible et la date de chaque commentaire en attente

### Requirement 9: Profil artiste — Section communautaire

**User Story:** En tant qu'utilisateur, je veux voir et participer aux interactions communautaires sur la page d'un artiste, afin de découvrir ce que la communauté pense de cet artiste.

#### Acceptance Criteria

1. THE page profil artiste SHALL afficher une section "Communauté" contenant une Interaction_Bar et une Comment_Section associées à l'artiste
2. THE section Communauté SHALL se positionner après les sections existantes (plateformes, réseaux, classements)
3. THE Interaction_Bar de la page artiste SHALL être synchronisée avec celle affichée sur les cartes podium de la page d'accueil pour le même artiste

### Requirement 10: Podium page d'accueil — Barre d'interaction

**User Story:** En tant qu'utilisateur, je veux pouvoir réagir directement depuis les cartes podium sur la page d'accueil, afin d'interagir rapidement sans visiter le profil artiste.

#### Acceptance Criteria

1. THE carte podium de la page d'accueil SHALL intégrer une Interaction_Bar compacte sous chaque artiste affiché
2. THE compteurs de réactions sur la carte podium SHALL refléter les mêmes valeurs que la page profil artiste correspondante
3. WHEN un Registered_User réagit depuis la carte podium, THE Interaction_Bar SHALL mettre à jour le compteur identiquement à la page profil artiste

### Requirement 11: Arena des Hits — Page dédiée

**User Story:** En tant qu'utilisateur, je veux accéder à une page Arena des Hits pour découvrir et voter dans des duels musicaux, afin de participer activement à la communauté musicale.

#### Acceptance Criteria

1. THE Arena SHALL être accessible via la route `/arena` dans la navigation du site
2. THE Arena SHALL afficher la liste des duels actifs, passés et à venir
3. THE Arena SHALL adopter une direction artistique Retro Gaming / Cyberpunk / Pixel Art / Arcade (palette néon, typographie pixel, effets lumineux CSS)
4. THE Arena SHALL fonctionner de manière responsive avec une priorité mobile et rester spectaculaire sur petit écran

### Requirement 12: Arena — Affichage d'un duel

**User Story:** En tant qu'utilisateur, je veux voir deux morceaux face à face avec leurs informations, afin de choisir pour lequel je vote.

#### Acceptance Criteria

1. THE Duel_Card SHALL afficher les deux morceaux côte à côte avec l'artwork, le titre et le nom de l'artiste pour chacun
2. THE Duel_Card SHALL afficher un séparateur "VS" visuel entre les deux morceaux
3. WHILE un duel est actif et non voté par l'utilisateur, THE Duel_Card SHALL afficher les boutons de vote sur chaque morceau
4. WHILE un duel est actif et déjà voté par l'utilisateur, THE Duel_Card SHALL afficher les pourcentages de vote et une barre de progression pour chaque morceau
5. WHEN les pourcentages de vote sont séparés de 5 points ou moins, THE Duel_Card SHALL afficher un badge "BATTLE INTENSE"

### Requirement 13: Arena — Animations de duel

**User Story:** En tant qu'utilisateur, je veux voir des animations engageantes pendant les duels, afin de vivre une expérience immersive dans l'Arena.

#### Acceptance Criteria

1. WHEN un duel est affiché pour la première fois, THE Arena SHALL jouer une animation de countdown (3, 2, 1, FIGHT) en CSS
2. THE Duel_Card SHALL afficher un effet visuel "VS" animé entre les deux morceaux
3. WHEN l'utilisateur survole une carte de morceau dans le duel, THE Duel_Card SHALL appliquer une réaction visuelle CSS (lueur, scale)
4. THE Arena SHALL utiliser exclusivement des animations CSS (pas de bibliothèque JavaScript d'animation) avec accélération GPU (transform, opacity)
5. WHEN le paramètre prefers-reduced-motion est actif, THE Arena SHALL désactiver toutes les animations et afficher le contenu de manière statique

### Requirement 14: Arena — Système de vote

**User Story:** En tant qu'utilisateur authentifié, je veux voter pour un morceau dans un duel actif, afin d'influencer le résultat du duel.

#### Acceptance Criteria

1. WHEN un Registered_User clique sur le bouton de vote d'un morceau, THE Arena SHALL enregistrer le vote en base de données et afficher les résultats dynamiques
2. THE Arena SHALL limiter chaque Registered_User à un seul vote par duel
3. IF un Registered_User tente de voter une seconde fois dans un même duel, THEN THE Arena SHALL ignorer le vote et afficher un message indiquant que le vote est déjà enregistré
4. IF un utilisateur non authentifié tente de voter, THEN THE Arena SHALL rediriger vers la page de connexion avec le chemin de retour vers le duel
5. WHEN un vote est enregistré, THE Arena SHALL recalculer et afficher les pourcentages mis à jour pour les deux morceaux
6. THE vote SHALL être sécurisé côté backend via une contrainte d'unicité (user_id + duel_id) et une politique RLS

### Requirement 15: Arena — Fin de duel et résultats

**User Story:** En tant qu'utilisateur, je veux voir clairement le résultat d'un duel terminé, afin de savoir quel morceau a gagné.

#### Acceptance Criteria

1. WHEN un duel atteint sa date de fin, THE Arena SHALL déterminer le morceau gagnant selon le nombre total de votes
2. WHEN le résultat est affiché, THE Duel_Card SHALL mettre en surbrillance le morceau gagnant avec une animation de victoire CSS
3. WHEN un duel est terminé, THE Duel_Card SHALL afficher les compteurs de votes finaux et les pourcentages pour chaque morceau
4. IF un duel se termine en égalité parfaite, THEN THE Arena SHALL afficher un badge "ÉGALITÉ" et mettre en surbrillance les deux morceaux

### Requirement 16: Arena — Duels automatiques

**User Story:** En tant que système, je veux générer automatiquement des duels à partir des morceaux existants, afin de maintenir un flux constant de contenu dans l'Arena.

#### Acceptance Criteria

1. THE Arena SHALL sélectionner automatiquement des paires de morceaux pour les duels à partir des données existantes (populaires, tendances, récents)
2. THE Arena SHALL éviter de créer un duel entre deux morceaux ayant déjà été opposés dans les 30 derniers jours
3. THE Arena SHALL configurer une durée par défaut de 24 heures pour les duels automatiques

### Requirement 17: Arena — Duels créés par l'administrateur

**User Story:** En tant qu'administrateur, je veux créer manuellement des duels avec des morceaux spécifiques, afin de mettre en avant des confrontations éditoriales.

#### Acceptance Criteria

1. WHEN un Admin_User accède au panneau d'administration de l'Arena, THE panneau admin SHALL afficher un formulaire de création de duel avec sélection de deux morceaux, dates de début et de fin, et description optionnelle
2. WHEN un Admin_User soumet le formulaire de création, THE système SHALL créer le duel avec les paramètres spécifiés et le statut "programmé" ou "actif" selon la date de début
3. THE panneau admin SHALL afficher la liste des duels existants avec leur statut (programmé, actif, terminé)

### Requirement 18: Arena — Duels proposés par les utilisateurs

**User Story:** En tant qu'utilisateur authentifié, je veux proposer un duel entre deux morceaux, afin de contribuer au contenu communautaire de l'Arena.

#### Acceptance Criteria

1. WHEN un Registered_User soumet une proposition de duel depuis l'Arena, THE Arena SHALL enregistrer la proposition avec le statut "en attente de modération"
2. THE formulaire de proposition SHALL permettre au Registered_User de sélectionner deux morceaux parmi les morceaux existants en base
3. WHEN un Admin_User approuve une proposition de duel, THE Moderation_Queue SHALL changer le statut à "approuvé" et programmer le duel
4. WHEN un Admin_User rejette une proposition de duel, THE Moderation_Queue SHALL changer le statut à "rejeté"

### Requirement 19: Arena — Navigation enchaînée

**User Story:** En tant qu'utilisateur, je veux enchaîner les duels sans revenir en arrière, afin de rester engagé dans l'expérience Arena.

#### Acceptance Criteria

1. WHEN un Registered_User a voté et consulté le résultat d'un duel, THE Arena SHALL afficher un bouton "Duel suivant" menant au prochain duel actif
2. THE Arena SHALL suivre le flux DUEL → VOTE → RÉSULTAT → DUEL SUIVANT sans retour à la liste
3. IF aucun duel actif suivant n'est disponible, THEN THE Arena SHALL afficher un message indiquant qu'aucun duel supplémentaire n'est disponible et proposer un retour à la liste

### Requirement 20: Intégration page d'accueil — Duel en vedette

**User Story:** En tant qu'utilisateur, je veux voir un duel mis en avant sur la page d'accueil, afin de découvrir l'Arena directement.

#### Acceptance Criteria

1. THE page d'accueil SHALL afficher une section "Duel en vedette" montrant le duel actif le plus récent ou le plus populaire
2. THE section duel en vedette SHALL afficher un Duel_Card compact avec les deux morceaux, les pourcentages actuels et un lien vers l'Arena
3. WHEN un Registered_User vote depuis la section duel en vedette, THE système SHALL enregistrer le vote de la même manière que depuis la page Arena

### Requirement 21: Base de données — Tables communautaires

**User Story:** En tant que système, je veux stocker les réactions, commentaires, duels et votes dans des tables Supabase dédiées, afin de persister les données communautaires de manière structurée.

#### Acceptance Criteria

1. THE système SHALL créer une table `reactions` avec les colonnes : id, user_id, target_type, target_id, reaction_type (like/hater), created_at et une contrainte d'unicité sur (user_id, target_type, target_id)
2. THE système SHALL créer une table `comments` avec les colonnes : id, user_id, target_type, target_id, category, content, status (pending/approved/rejected), created_at
3. THE système SHALL créer une table `duels` avec les colonnes : id, track_a_id, track_b_id, created_by, source (auto/admin/user), status (scheduled/active/finished), starts_at, ends_at, description, created_at
4. THE système SHALL créer une table `duel_votes` avec les colonnes : id, duel_id, user_id, chosen_track_id, created_at et une contrainte d'unicité sur (duel_id, user_id)
5. THE système SHALL réutiliser les tables Supabase existantes (artists, tracks, chart_entries) sans les modifier

### Requirement 22: Sécurité — Politiques RLS et vérifications

**User Story:** En tant que système, je veux appliquer des politiques de sécurité sur les tables communautaires, afin de protéger les données et empêcher les abus.

#### Acceptance Criteria

1. THE RLS sur la table `reactions` SHALL permettre à un Registered_User de lire toutes les réactions, d'insérer ses propres réactions et de supprimer uniquement ses propres réactions
2. THE RLS sur la table `comments` SHALL permettre à un Registered_User de lire les commentaires approuvés, d'insérer ses propres commentaires (statut initial "pending"), et permettre à un Admin_User de mettre à jour le statut
3. THE RLS sur la table `duel_votes` SHALL permettre à un Registered_User de lire tous les votes, d'insérer un vote uniquement si aucun vote existant pour le même duel et le même utilisateur
4. THE RLS sur la table `duels` SHALL permettre la lecture publique des duels actifs et terminés, et permettre uniquement aux Admin_User de créer et modifier des duels

### Requirement 23: Responsive — Priorité mobile

**User Story:** En tant qu'utilisateur mobile, je veux que l'Arena et toutes les interactions communautaires soient pleinement fonctionnelles et visuellement réussies sur petit écran, afin de profiter de l'expérience sur mon téléphone.

#### Acceptance Criteria

1. THE Duel_Card SHALL s'adapter en disposition verticale (morceaux empilés) sur les écrans de largeur inférieure à 768px
2. THE Interaction_Bar SHALL conserver une taille de zone tactile minimale de 44x44 pixels pour chaque bouton sur mobile
3. THE Comment_Section SHALL afficher les filtres de catégorie en défilement horizontal sur mobile
4. THE Arena SHALL occuper la largeur complète de l'écran sur mobile sans débordement horizontal

### Requirement 24: Performance — Animations optimisées

**User Story:** En tant qu'utilisateur, je veux que les animations de l'Arena soient fluides sans impact sur les performances, afin d'avoir une expérience agréable y compris sur appareils modestes.

#### Acceptance Criteria

1. THE Arena SHALL utiliser exclusivement les propriétés CSS `transform` et `opacity` pour les animations afin d'activer la composition GPU
2. THE Arena SHALL appliquer `will-change` uniquement sur les éléments activement animés et le retirer après la fin de l'animation
3. WHEN le media query `prefers-reduced-motion: reduce` est actif, THE Arena SHALL remplacer toutes les animations par des transitions instantanées
4. THE Arena SHALL limiter le nombre d'éléments animés simultanément à un maximum de 5 par viewport visible

