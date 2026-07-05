# Planet HMI — Cahier des charges complet (référence fusionnée)

---

<!-- SOURCE: README.md -->

# Planet HMI — Kiro / Claude Opus 4.8 Build Pack

Ce dossier est le cahier des charges exécutable de **Planet HMI**, plateforme de référence pour la musique haïtienne. Il est structuré pour un développement guidé par Kiro : contexte permanent dans `.kiro/steering`, spécifications par fonctionnalité dans `.kiro/specs`, documentation détaillée dans `docs`.

## 1. Objectif

Construire un produit web premium, rapide, crédible et administrable comprenant :

- HMI Charts : classements d'artistes, titres, albums et tendances.
- Profils artistes et discographies.
- Fiches titres/albums, statistiques et historiques.
- Recherche globale.
- Comptes utilisateurs.
- Revendication et gestion de profils artistes.
- Back-office de validation et modération.
- HMI Shorts fondé uniquement sur des intégrations ou extraits autorisés.
- Univers visuel « Planet HMI » : cosmique, haïtien, moderne et sobre.
- Overlay scénique subtil avec quatre projecteurs décoratifs, faisceaux CSS et fumée légère.
- Infrastructure de collecte, normalisation et publication des données.
- Moteur de classement transparent et versionné.

## 2. Principe d'exécution dans Kiro

Ne demande pas à Kiro de « tout coder en une fois ». Utilise le flux suivant :

1. Ouvrir le dépôt dans Kiro.
2. Conserver les fichiers `.kiro/steering/*` actifs en permanence.
3. Commencer par la spec `foundation`.
4. Exécuter les tâches une par une.
5. Lancer les tests et valider les critères d'acceptation avant de passer à la tâche suivante.
6. Passer ensuite à la spec `mvp-core`.
7. Créer une nouvelle Feature Spec pour chaque module futur.

## 3. Ordre recommandé

1. Fondation technique et design system.
2. Modèle de données et migrations.
3. Authentification, rôles et permissions.
4. Back-office minimal.
5. Artistes, titres, albums.
6. Accueil et charts.
7. Recherche.
8. Revendication de profil.
9. HMI Shorts via embeds officiels.
10. Collecte de données et moteur de classement.
11. SEO, performance, sécurité et observabilité.
12. Fonctionnalités V2 : battles, awards, événements, notifications avancées.

## 4. Livrables attendus

Chaque module doit produire :

- Code TypeScript strict.
- Migrations SQL reproductibles.
- Composants accessibles et responsive.
- États loading, empty, error et success.
- Tests unitaires, intégration et E2E ciblés.
- Documentation mise à jour.
- Journal des décisions techniques.
- Aucun secret dans le dépôt.
- Aucune donnée ou œuvre protégée hébergée sans autorisation.

## 5. Commande de départ à donner à Kiro

Copier le contenu de `00_MASTER_KIRO_PROMPT.md` dans Kiro, puis lui demander d'analyser la spec `foundation` et de commencer uniquement la première tâche non terminée.

---

<!-- SOURCE: 00_MASTER_KIRO_PROMPT.md -->

# Master Prompt — Planet HMI

Tu es le lead engineer de Planet HMI. Tu travailles dans Kiro et tu dois suivre strictement les fichiers de steering, les specs et la documentation de ce dépôt.

## Règles de fonctionnement

1. Lis d'abord tous les fichiers de `.kiro/steering/`.
2. Lis ensuite uniquement la spec active dans `.kiro/specs/<nom-de-spec>/`.
3. Consulte les documents de `docs/` cités par la spec active.
4. N'implémente qu'une tâche à la fois.
5. Avant de coder, résume :
   - la tâche active ;
   - les fichiers probablement touchés ;
   - les risques ;
   - les critères d'acceptation.
6. Après le code :
   - exécute lint, typecheck et tests pertinents ;
   - corrige les erreurs ;
   - marque la tâche terminée uniquement si les critères sont satisfaits ;
   - mets à jour la documentation lorsque le comportement public change.
7. Ne modifie jamais une décision d'architecture structurante sans créer une ADR dans `docs/adr/`.
8. N'invente pas d'API externe ni de donnée disponible. Crée un adaptateur et un mode mock si l'accès réel n'existe pas.
9. Utilise uniquement des intégrations, métadonnées, images, extraits et embeds autorisés.
10. Ne contourne jamais les restrictions de plateformes et n'héberge pas d'extraits musicaux non licenciés.

## Priorités

Dans cet ordre :

1. Exactitude des données.
2. Sécurité et permissions.
3. Maintenabilité.
4. Accessibilité.
5. Performance.
6. Fidélité visuelle.
7. Animations avancées.

## Définition de « terminé »

Une tâche est terminée seulement si :

- le code compile ;
- les migrations sont valides ;
- les tests prévus passent ;
- les états d'erreur et de chargement existent ;
- le responsive a été vérifié ;
- aucune permission n'est contournable côté client ;
- les critères d'acceptation sont démontrés ;
- les limitations sont documentées.

## Première instruction

Analyse la spec `.kiro/specs/foundation/`. Commence uniquement par la première tâche non cochée dans `tasks.md`. Ne lance pas encore la spec `mvp-core`.

---

<!-- SOURCE: 01_KIRO_PROMPT_SEQUENCE.md -->

# Séquence de prompts à utiliser dans Kiro

## Prompt 1 — Audit initial

Lis tous les fichiers `.kiro/steering/`, puis `.kiro/specs/foundation/requirements.md`, `design.md` et `tasks.md`. Analyse le dépôt sans modifier de fichier. Donne-moi :
1. les prérequis manquants ;
2. les décisions déjà imposées ;
3. les risques ;
4. la première tâche exacte à exécuter.
Ne commence pas encore le code.

## Prompt 2 — Première tâche

Exécute uniquement la première tâche non cochée de `.kiro/specs/foundation/tasks.md`. Respecte les critères de `requirements.md`. À la fin, lance les contrôles pertinents, montre les résultats et coche la tâche seulement si elle est réellement terminée.

## Prompt récurrent

Continue avec uniquement la prochaine tâche non cochée de la spec active. Avant de coder, vérifie les dépendances et les critères d’acceptation. Après le code, exécute lint, typecheck et tests pertinents. Ne passe pas à une autre tâche tant que celle-ci n’est pas validée.

## Prompt de revue de jalon

La section actuelle de tâches est terminée. Effectue une revue comme un lead engineer :
- conformité steering/spec ;
- architecture ;
- sécurité/RLS ;
- accessibilité ;
- performance ;
- tests ;
- dette technique ;
- documentation.
Corrige uniquement les défauts bloquants ou élevés, puis produis un rapport court.

## Prompt avant MVP Core

Vérifie que toutes les tâches Foundation sont cochées et réellement satisfaites. Lis ensuite `.kiro/specs/mvp-core/*` et les documents référencés. Ne code pas. Propose le découpage en petites pull requests, avec ordre, dépendances et tests.

## Prompt pour éviter les hallucinations d’API

Pour toute plateforme externe, vérifie d’abord si des credentials, une documentation officielle et des droits d’usage existent dans le projet. Sinon, implémente uniquement l’interface d’adaptateur, un mock de développement et un état « non configuré ». N’invente ni endpoint, ni quota, ni métrique disponible.

## Prompt de correction ciblée

Voici un bug précis : [décrire]. Identifie la cause racine, le test manquant et le plus petit correctif sûr. Ne refactorise pas des modules non concernés. Ajoute un test de non-régression et exécute les contrôles.

## Prompt de release

Prépare une release candidate sans ajouter de fonctionnalité :
- build production ;
- migrations ;
- tests ;
- audit RLS ;
- variables d’environnement ;
- fixtures ;
- liens cassés ;
- SEO ;
- accessibilité ;
- performance ;
- logs/alertes ;
- rollback.
Produis une checklist PASS/FAIL avec preuves.

---

<!-- SOURCE: 02_PROJECT_ASSUMPTIONS.md -->

# Hypothèses et décisions à valider par le Product Owner

Ce document isole les choix que le code peut utiliser par défaut, mais qui pourront être modifiés sans réécrire toute la vision.

## Nom

- Marque principale : Planet HMI.
- Module de classement : HMI Charts.
- Flux vertical : HMI Shorts.
- Score : HMI Score.

## Langue de lancement

Hypothèse : français comme langue principale, architecture prête pour créole haïtien et anglais.

## Marché

Public mondial intéressé par la musique haïtienne, avec priorité Haïti et diaspora. Ne pas prétendre mesurer séparément Haïti/diaspora tant que les sources ne le permettent pas.

## Modération

Hypothèse : toute modification proposée par artiste exige validation pendant le MVP.

## Charts

Hypothèse : publication hebdomadaire. La période exacte est configurable. Aucune formule n’est « officielle » avant dry-runs sur données réelles.

## Sources

Aucune plateforme n’est considérée disponible par défaut. Les intégrations sont activées une par une après obtention des accès et validation juridique/technique.

## Médias

Aucun extrait audio commercial n’est hébergé sans licence. HMI Shorts privilégie embeds officiels et contenus autorisés.

## Monétisation

Hors MVP. Les futurs contenus sponsorisés devront être identifiés et séparés des classements.

## Design

Thème sombre spatial par défaut, bleu/rouge/blanc comme identité haïtienne. L’univers cosmique reste optionnel sur appareils faibles.

## Hébergement

Hypothèse : Vercel + Supabase pour réduire la complexité initiale. L’architecture doit permettre une migration.

## Décisions nécessitant un choix futur

- Logo final et fichiers de marque.
- Typographies licenciées ou libres.
- Domaine.
- Forme juridique et mentions légales.
- Sources de données réellement contractées.
- Période officielle des charts.
- Seuils et poids HMI Score après tests.
- Processus exact de vérification d’artiste.
- Politique de conservation des preuves.
- Langues disponibles au lancement.

---

<!-- SOURCE: 03_ASSET_CHECKLIST.md -->

# Checklist des éléments à fournir au projet

## Marque

- Logo principal SVG.
- Logo compact/icône.
- Versions sombre, claire et monochrome.
- Favicon.
- Règles d’espace et taille minimale.
- Police ou décision typographique.

## Contenu

- Texte officiel « À propos ».
- Mission et slogan validés.
- Contact public.
- Email de support.
- Réseaux sociaux officiels.
- Politique éditoriale.

## Juridique

- Conditions d’utilisation.
- Politique de confidentialité.
- Politique de cookies si nécessaire.
- Processus de retrait de contenu.
- Adresse légale selon entité.
- Politique de droits d’auteur.

## Données

- Premier catalogue d’artistes.
- Genres validés.
- Sources de chaque donnée.
- Premier jeu de sorties.
- Identifiants externes.
- Règles de correction.
- Échantillon CSV.

## Images

- Photos autorisées.
- Pochettes avec droit d’affichage.
- Crédits.
- Alt text ou descriptions.
- Images hero.

## Intégrations

Pour chaque plateforme :

- accès développeur ;
- credentials ;
- documentation ;
- quotas ;
- permission d’affichage ;
- politique de cache ;
- contact partenaire.

## Opérations

- Comptes admin initiaux.
- Procédure de récupération.
- Canal d’alerte.
- Responsable modération.
- Responsable données.
- Calendrier de publication.

---

<!-- SOURCE: .kiro/steering/product.md -->

---
inclusion: always
---

# Produit — Planet HMI

## Mission

Planet HMI rend la musique haïtienne plus visible, mesurable, découvrable et documentée. La plateforme doit devenir une source de référence pour les fans, artistes, producteurs, médias, labels, promoteurs et chercheurs.

## Promesse

« Là où les étoiles de la musique haïtienne deviennent des légendes. »

## Marques

- **Planet HMI** : marque ombrelle et univers produit.
- **HMI Charts** : classements et données.
- **HMI Shorts** : découverte verticale par contenus intégrés ou autorisés.
- **HMI Score** : score propriétaire, transparent, versionné et auditable.

## Publics

1. Fans de musique haïtienne, en Haïti et dans la diaspora.
2. Artistes, managers, labels et distributeurs.
3. Médias, DJs, promoteurs et organisateurs.
4. Professionnels recherchant des tendances et données.
5. Administrateurs et analystes HMI.

## Principes produit

- La crédibilité vaut plus que le volume.
- Toute métrique publiée possède une provenance et une date.
- Les votes utilisateurs ne doivent jamais dominer les classements principaux.
- Les contenus officiels, autorisés ou intégrés sont prioritaires.
- Le produit doit fonctionner correctement sur mobile et connexions limitées.
- L'univers cosmique soutient la lecture ; il ne doit jamais nuire à l'usage.
- Les pages principales doivent rester compréhensibles sans animation.
- Les fonctions non disponibles utilisent un état explicite, jamais de fausses données.

## Portée MVP

Le MVP comprend : accueil, charts, artistes, titres, albums, recherche, comptes, favoris, revendication de profil, dashboard artiste limité, back-office, import manuel/CSV, snapshots de métriques, moteur HMI Score v1 et HMI Shorts par embeds officiels.

## Hors MVP

Battles temps réel, awards complets, marketplace, billetterie, messagerie, abonnements payants, scraping non autorisé, application native, recommandations IA complexes.

---

<!-- SOURCE: .kiro/steering/tech.md -->

---
inclusion: always
---

# Architecture technique imposée

## Stack de référence

- Application full-stack : Next.js App Router, TypeScript strict.
- UI : React, Tailwind CSS, composants accessibles de type shadcn/Radix.
- Données : PostgreSQL hébergé via Supabase.
- Authentification : Supabase Auth.
- Stockage : Supabase Storage.
- Realtime : Supabase Realtime uniquement lorsque justifié.
- Validation : Zod pour toutes les frontières de données.
- Formulaires : React Hook Form ou Server Actions validées par Zod.
- Tests : Vitest, Testing Library, Playwright.
- Déploiement : Vercel pour l'application, Supabase pour données/auth/stockage.
- Observabilité : journalisation structurée, suivi d'erreurs compatible Sentry.
- Analytics : solution respectueuse de la vie privée et désactivable.

## Règles

- TypeScript `strict: true`.
- Pas de `any` non justifié.
- Server Components par défaut.
- Client Components seulement pour interaction, état local ou APIs navigateur.
- Les secrets restent côté serveur.
- Toute écriture critique passe par une vérification serveur des permissions.
- Les migrations sont versionnées.
- Les appels aux plateformes externes passent par des adaptateurs.
- Les tâches différées sont idempotentes.
- Les images sont optimisées et possèdent des dimensions explicites.
- Aucun package n'est ajouté sans justification.
- La version exacte des dépendances est verrouillée dans le lockfile.
- Éviter les versions « latest » dans les scripts de production.

## Structure cible

```text
app/
  (public)/
  (auth)/
  dashboard/
  admin/
  api/
components/
  ui/
  layout/
  charts/
  artists/
  music/
  shorts/
lib/
  auth/
  db/
  permissions/
  ranking/
  integrations/
  validation/
  seo/
  observability/
supabase/
  migrations/
  seed/
tests/
  unit/
  integration/
  e2e/
```

## Séparation des responsabilités

- UI : rendu et interaction.
- Services : règles métier.
- Repositories : accès aux données.
- Adapters : plateformes externes.
- Jobs : import, snapshots et recalculs.
- Policies/RLS : dernière ligne de défense au niveau base de données.

---

<!-- SOURCE: .kiro/steering/structure.md -->

---
inclusion: always
---

# Conventions de code et structure

## Nommage

- Fichiers et dossiers : kebab-case.
- Composants React : PascalCase.
- Fonctions/variables : camelCase.
- Types métier : noms explicites, sans préfixe `I`.
- Tables SQL : snake_case, pluriel.
- Enumérations : minuscules en base, unions typées côté application.

## Imports

- Utiliser les alias configurés.
- Interdire les imports circulaires.
- Un module de domaine ne doit pas importer un module d'interface.
- Les exports « barrel » sont limités aux APIs stables.

## Composants

Chaque composant réutilisable doit gérer :

- état normal ;
- état loading si asynchrone ;
- état empty ;
- état error ;
- clavier et focus ;
- réduction des animations ;
- tailles mobile et desktop.

## Services

Les services métier :

- n'accèdent pas directement à `window` ;
- reçoivent leurs dépendances ;
- retournent des résultats typés ;
- distinguent erreurs métier, validation, permission et infrastructure ;
- sont testables sans réseau.

## API

- Réponses JSON cohérentes : `data`, `error`, `meta`.
- Codes HTTP corrects.
- Validation de l'entrée.
- Authentification et autorisation séparées.
- Pagination par curseur pour les flux importants.
- Rate limiting sur recherche, votes, auth et imports.
- Idempotency key sur opérations réessayables.

## Git

- Commits petits et descriptifs.
- Une tâche Kiro peut produire plusieurs commits cohérents.
- Aucun fichier généré lourd ou secret dans Git.
- Toute décision structurante crée une ADR.

---

<!-- SOURCE: .kiro/steering/design.md -->

---
inclusion: always
---

# Direction visuelle et UX

## Identité

Planet HMI combine :

- crédibilité éditoriale de sites de charts ;
- énergie de la musique haïtienne ;
- univers cosmique premium ;
- minimalisme fonctionnel.

## Palette de base

- Bleu HMI profond : `#071B3A`
- Bleu électrique : `#145BFF`
- Rouge HMI : `#E52535`
- Blanc : `#F8FAFC`
- Noir spatial : `#030712`
- Surface sombre : `#0B1220`
- Texte secondaire : `#9AA7B8`
- Succès : `#2ECF8F`
- Avertissement : `#F4B740`

Les contrastes WCAG priment sur la fidélité décorative.

## Typographie

- Titres : sans-serif géométrique forte.
- Texte : sans-serif très lisible.
- Données : chiffres tabulaires.
- Ne pas charger plus de deux familles de polices.

## Style

- Cartes nettes, bordures subtiles, rayon modéré.
- Glassmorphism réservé aux éléments héro et overlays.
- Rouge et bleu utilisés comme accents, pas comme fond simultané partout.
- Effets cosmiques légers : gradients, étoiles peu nombreuses, profondeur.
- Pas de surcharge néon.
- Les tableaux et classements doivent rester éditoriaux et lisibles.

## Animation

- 150–250 ms pour micro-interactions.
- 300–500 ms pour transitions de sections.
- Transform et opacity en priorité.
- Respecter `prefers-reduced-motion`.
- Pas d'animation permanente sur les listes longues.
- Aucun audio UI automatique.
- Les aperçus audio/vidéo exigent une action explicite ou un comportement autorisé par la plateforme.

## Effet scénique global — `StageLightsOverlay`

Créer un composant React décoratif `StageLightsOverlay` pour donner une ambiance de scène de concert premium, sans nuire à la lisibilité ni aux performances.

Règles permanentes :

- quatre projecteurs décoratifs positionnés dans les quatre coins de la page ;
- faisceaux lumineux animés uniquement en CSS ;
- légère fumée animée, diffuse et peu opaque ;
- `pointer-events: none` sur l’overlay et tous ses descendants ;
- élément purement décoratif avec `aria-hidden="true"`, sans contenu focusable ;
- faible opacité et contraste maîtrisé : le texte et les données restent prioritaires ;
- responsive avec tailles calculées via `clamp()` et sans débordement horizontal ;
- animation basée principalement sur `transform` et `opacity` ;
- aucune dépendance d’animation lourde, aucun canvas et aucun WebGL pour cet effet ;
- prise en charge de `prefers-reduced-motion: reduce` : arrêter les animations et conserver au plus un état statique très subtil ;
- réduire ou supprimer la fumée en mode économie de données ;
- ne pas monter plusieurs overlays identiques sur une même page.

L’effet doit évoquer une scène de concert haut de gamme, jamais une discothèque agressive. Il doit rester optionnel, désactivable et placé derrière le contenu interactif.

## Responsive

- Mobile-first.
- Cibles tactiles d'au moins 44 × 44 px.
- Navigation mobile compacte.
- Les tableaux deviennent des cartes ou listes structurées.
- Le contenu principal ne dépend jamais du hover.

---

<!-- SOURCE: docs/00_DOCUMENT_INDEX.md -->

# Index de la documentation

1. `01_PRODUCT_BIBLE.md` — vision, positionnement, publics et marque.
2. `02_SCOPE_AND_RELEASES.md` — MVP, versions futures et hors périmètre.
3. `03_INFORMATION_ARCHITECTURE.md` — pages, routes et contenus.
4. `04_DESIGN_SYSTEM.md` — tokens, composants, animation et accessibilité.
5. `05_DATA_MODEL.md` — tables, relations, indexes et RLS.
6. `06_AUTH_ROLES_AND_WORKFLOWS.md` — comptes, permissions, claims et modifications.
7. `07_PUBLIC_EXPERIENCE.md` — accueil, charts, profils, recherche et Shorts.
8. `08_ARTIST_ADMIN_AND_MODERATION.md` — dashboard, admin, import et audit.
9. `09_RANKING_ENGINE.md` — HMI Score, normalisation, confiance et anti-manipulation.
10. `10_INTEGRATIONS_AND_MEDIA.md` — APIs, embeds, audio, images et jobs.
11. `11_SECURITY_PRIVACY_PERFORMANCE.md` — sécurité, confidentialité, SEO et performance.
12. `12_TESTING_AND_ACCEPTANCE.md` — stratégie de test et Definition of Done.
13. `13_DEPLOYMENT_AND_OPERATIONS.md` — environnements, CI/CD, runbooks et coûts.
14. `14_ROADMAP.md` — ordre de construction et jalons.

---

<!-- SOURCE: docs/01_PRODUCT_BIBLE.md -->

# 01 — Product Bible

## 1. Vision

Planet HMI est une infrastructure culturelle et numérique destinée à documenter, classer et faire découvrir la musique haïtienne. Le produit ne doit pas être une simple copie de Billboard ou Genius : il doit combiner la crédibilité des classements, la richesse des profils éditoriaux et une identité propre inspirée d’un univers planétaire.

L’ambition à long terme est de devenir la source consultée lorsqu’une personne souhaite savoir :

- quels artistes et titres dominent actuellement ;
- quelles œuvres progressent le plus rapidement ;
- qui est un artiste et quelle est sa discographie ;
- quels records ont été établis ;
- quels contenus sont populaires en Haïti et dans la diaspora ;
- comment une carrière ou une sortie évolue dans le temps.

## 2. Problèmes résolus

### Pour les fans

- L’information sur la musique haïtienne est dispersée.
- Les discographies sont souvent incomplètes ou incohérentes.
- Les tendances sont visibles plateforme par plateforme, mais rarement consolidées.
- Les artistes émergents sont difficiles à découvrir.

### Pour les artistes

- Les profils disponibles en ligne ne leur permettent pas toujours de contrôler ou corriger leurs données.
- Les performances sont difficiles à présenter de manière centralisée.
- Les sorties, crédits et collaborations sont parfois mal attribués.
- Il manque une référence sectorielle indépendante et spécialisée.

### Pour les professionnels

- Il est difficile d’évaluer la traction réelle d’un artiste.
- Les données historiques sont rarement conservées.
- Les classements existants ne documentent pas toujours leur méthode.
- Les médias ont besoin de données réutilisables et vérifiables.

## 3. Positionnement

Planet HMI se place au croisement de quatre catégories :

1. **Charts et data** : classements, scores, historiques et records.
2. **Encyclopédie musicale** : artistes, œuvres, crédits, genres et biographies.
3. **Découverte** : tendances, nouveaux talents, HMI Shorts et recommandations éditoriales.
4. **Outil professionnel** : revendication de profils, correction de données et tableaux de bord.

## 4. Valeurs

- **Crédibilité** : ne jamais afficher comme certain ce qui n’est pas vérifié.
- **Transparence** : expliquer la méthode du HMI Score et ses limites.
- **Équité** : réduire les biais de plateforme, de taille d’audience et de budget marketing.
- **Culture** : valoriser l’ensemble de la musique haïtienne et sa diaspora.
- **Simplicité** : rendre les données compréhensibles.
- **Responsabilité** : respecter les droits d’auteur, les conditions des plateformes et la vie privée.

## 5. Taxonomie musicale initiale

La taxonomie doit rester administrable, mais le seed initial peut inclure :

- Kompa
- Rap kreyòl / Hip-hop haïtien
- Rabòday
- Rara
- Racine
- Gospel
- Zouk / influences caribéennes
- Afro / Afrobeats fusion
- Pop haïtienne
- Musique traditionnelle
- Jazz haïtien
- Électro / dance
- Autre / hybride

Un artiste et une œuvre peuvent avoir plusieurs genres. Un genre principal peut être défini pour l’affichage.

## 6. Architecture de marque

### Planet HMI

Le monde global. Il porte l’identité cosmique, la page d’accueil, la navigation et l’expérience de découverte.

### HMI Charts

Le système de classement. Ton visuel plus éditorial, plus sobre et plus orienté données.

### HMI Shorts

Flux de découverte verticale. Les contenus doivent provenir d’intégrations officielles, d’uploads autorisés par les ayants droit ou de médias appartenant à Planet HMI.

### HMI Score

Score synthétique de performance. Il ne représente pas une valeur artistique. Il représente uniquement une performance mesurée selon une méthode et une période données.

## 7. Principes d’expérience

- Une personne doit comprendre la valeur du site en moins de dix secondes.
- Les charts principaux sont accessibles en un clic.
- Chaque rang affiche clairement l’évolution : montée, baisse, stable, nouvelle entrée.
- Chaque métrique importante affiche sa période et sa provenance.
- Les profils artistes privilégient la clarté avant l’immersion.
- Les animations doivent enrichir l’entrée dans l’univers, pas ralentir la consultation.
- Les connexions lentes reçoivent une expérience allégée automatiquement.
- Aucun contenu essentiel ne dépend du son, de la vidéo ou du hover.

## 8. Indicateurs produit

### Acquisition

- visites organiques ;
- pages indexées ;
- taux de clic vers profils et charts ;
- visiteurs de la diaspora par région agrégée.

### Activation

- recherche effectuée ;
- premier profil consulté ;
- premier favori ;
- première lecture d’un média intégré ;
- première inscription.

### Rétention

- retour hebdomadaire ;
- consultation récurrente des charts ;
- alertes ou favoris suivis ;
- artistes revenant gérer leur profil.

### Qualité

- taux de profils avec sources vérifiées ;
- taux de demandes de correction résolues ;
- fraîcheur moyenne des snapshots ;
- part des classements disposant d’un niveau de confiance suffisant ;
- incidents de données et temps de résolution.

## 9. Règle anti-fausse promesse

Le MVP ne doit jamais simuler une donnée externe en production. En absence d’accès API :

- afficher « donnée indisponible » ;
- permettre une saisie manuelle sourcée ;
- utiliser des fixtures uniquement en environnement de démonstration ;
- marquer les données de démonstration comme telles.

---

<!-- SOURCE: docs/02_SCOPE_AND_RELEASES.md -->

# 02 — Portée, versions et priorités

## 1. Méthode de priorisation

Chaque fonctionnalité est classée selon :

- valeur pour le public ;
- valeur pour la crédibilité des données ;
- dépendances techniques ;
- coût de maintenance ;
- risque juridique ou plateforme ;
- capacité à fonctionner sans contrat externe.

## 2. MVP — Version publiable

### Public

- Accueil.
- Navigation responsive.
- Page HMI Charts.
- Classements artistes, titres et albums.
- Filtres par période, catégorie et genre.
- Profils artistes.
- Pages titres et albums.
- Recherche globale.
- Pages genres.
- Pages méthodologie, à propos, contact, confidentialité et conditions.
- HMI Shorts basé sur embeds autorisés.
- Partage social et métadonnées SEO.
- Mode sombre par défaut ; mode clair optionnel si bien supporté.

### Comptes

- Inscription et connexion.
- Vérification d’email.
- Réinitialisation du mot de passe.
- Profil utilisateur minimal.
- Favoris artistes, titres et albums.
- Signalement d’erreur ou de contenu.
- Demande de revendication d’un profil artiste.

### Artistes vérifiés

- Tableau de bord.
- Modification proposée de biographie, images, liens et informations.
- Ajout proposé de sorties.
- Visualisation de l’état des demandes.
- Accès à des statistiques internes simples.
- Aucun changement public direct sans validation, sauf champs explicitement autorisés.

### Administration

- CRUD artistes, titres, albums, genres, labels et crédits.
- File de modération.
- Validation des revendications.
- Import CSV.
- Gestion des snapshots de métriques.
- Exécution contrôlée du recalcul des charts.
- Publication/dépublication.
- Journal d’audit.
- Gestion des contenus HMI Shorts.
- Gestion des comptes et rôles.

### Données

- Provenance et date de collecte.
- Snapshots immuables.
- HMI Score v1.
- Classements hebdomadaires.
- Historique des rangs.
- Niveau de confiance.
- Mode de calcul versionné.
- Exports internes CSV.

## 3. V1.1

- Notifications sur favoris.
- Pages de records.
- Comparaison d’artistes.
- Meilleure visualisation des trajectoires.
- Collections éditoriales.
- Soumission structurée d’événements.
- API publique en lecture limitée.
- Internationalisation créole/français/anglais plus complète.

## 4. V2

- Battles.
- Votes communautaires séparés des charts officiels.
- HMI Awards.
- Événements et concerts.
- Pages labels et producteurs enrichies.
- Comptes managers multi-artistes.
- Rapports professionnels exportables.
- Abonnement premium.
- Sponsoring et espaces publicitaires clairement identifiés.
- Applications mobiles si les usages le justifient.

## 5. Hors périmètre explicite

- Scraping contournant des restrictions.
- Téléchargement de vidéos TikTok/YouTube pour les réhéberger.
- Modification de pitch/BPM pour éviter le droit d’auteur.
- Vente de streams, votes ou visibilité cachée.
- Classements influencés secrètement par la publicité.
- Messagerie privée non modérée.
- Marketplace de droits musicaux.
- Hébergement d’un catalogue musical complet sans licences.

## 6. Critères de lancement du MVP

Le produit peut être rendu public lorsque :

- les pages critiques sont responsive ;
- le parcours recherche → profil → œuvre fonctionne ;
- au moins un chart réel ou éditorialement sourcé est disponible ;
- les données de démonstration sont absentes de la production ;
- les permissions ont été testées ;
- les sauvegardes sont activées ;
- les mentions légales et la politique de confidentialité sont disponibles ;
- les performances mobiles sont acceptables ;
- les erreurs critiques sont suivies ;
- le back-office permet de corriger rapidement toute donnée publiée.

## 7. Dégradation acceptable

En cas de panne d’une source externe :

- conserver le dernier snapshot valide ;
- afficher sa date ;
- réduire le niveau de confiance ;
- ne pas supprimer brutalement les entités du chart ;
- empêcher un recalcul trompeur si les données sont trop incomplètes ;
- journaliser l’incident.

---

<!-- SOURCE: docs/03_INFORMATION_ARCHITECTURE.md -->

# 03 — Architecture de l’information et pages

## 1. Navigation principale

### Desktop

- Logo Planet HMI.
- Charts.
- Artistes.
- Musique.
- Shorts.
- Découvrir.
- Barre de recherche.
- Connexion ou avatar.

### Mobile

- En-tête compact.
- Recherche accessible immédiatement.
- Navigation basse ou menu latéral contenant :
  - Accueil ;
  - Charts ;
  - Artistes ;
  - Shorts ;
  - Favoris ;
  - Compte.

## 2. Arborescence publique

```text
/
 /charts
   /artists
   /songs
   /albums
   /trending
   /history/[chartSlug]/[issueDate]
 /artists
   /[artistSlug]
 /songs/[songSlug]
 /albums/[albumSlug]
 /genres/[genreSlug]
 /shorts
 /discover
 /search
 /methodology
 /about
 /contact
 /legal/privacy
 /legal/terms
```

## 3. Arborescence authentifiée

```text
/account
/account/profile
/account/favorites
/account/submissions
/claim/[artistSlug]
/dashboard
/dashboard/artist/[artistId]
/dashboard/artist/[artistId]/profile
/dashboard/artist/[artistId]/releases
/dashboard/artist/[artistId]/analytics
/dashboard/artist/[artistId]/requests
```

## 4. Administration

```text
/admin
/admin/artists
/admin/releases
/admin/charts
/admin/data-sources
/admin/imports
/admin/moderation
/admin/claims
/admin/shorts
/admin/users
/admin/audit
/admin/settings
```

## 5. Page d’accueil

Ordre recommandé :

1. Hero Planet HMI avec proposition de valeur.
2. Extrait du classement principal.
3. Section « En ascension ».
4. Nouvelles sorties.
5. Artistes à découvrir.
6. HMI Shorts.
7. Records ou faits marquants.
8. Méthodologie et transparence.
9. Newsletter ou création de compte.
10. Footer complet.

Le hero ne doit pas occuper plus d’un écran sur mobile. Un CTA principal mène aux Charts, un CTA secondaire à la découverte.

## 6. Page Charts

### En-tête

- Titre du chart.
- Période.
- Date de publication.
- Description courte.
- Niveau de confiance ou badge de données.
- Lien vers méthodologie.

### Filtres

- Hebdomadaire, mensuel, annuel si disponibles.
- Artistes, titres, albums.
- Tous les genres ou genre spécifique.
- Haïti, diaspora, global uniquement si les données autorisent réellement cette segmentation.

### Ligne de classement

- Rang.
- Évolution.
- Visuel.
- Titre principal.
- Artiste(s).
- Score ou métrique affichable.
- Pic historique.
- Nombre de semaines.
- Bouton détail.
- Lecture via intégration autorisée, facultative.

## 7. Profil artiste

Sections :

- Hero : photo, nom, statut vérifié, genres, localisation publique, liens.
- Résumé.
- Statistiques clés.
- Position actuelle dans les charts.
- Titres populaires.
- Discographie filtrable.
- Albums et EP.
- Collaborations.
- Historique de classement.
- Biographie.
- Crédits et membres si groupe.
- Liens officiels.
- Sources et date de mise à jour.
- Bouton de correction ou revendication.

## 8. Page titre

- Pochette.
- Titre, artistes principaux et invités.
- Date de sortie.
- Type de sortie.
- Album parent.
- Crédits.
- Identifiants externes.
- Liens officiels.
- HMI Score actuel.
- Historique.
- Positions dans les charts.
- Média intégré autorisé.
- Paroles uniquement si licence ou intégration autorisée.
- Versions/remixes liés.

## 9. Page album

- Pochette.
- Titre, artiste, label.
- Type : album, EP, mixtape, compilation.
- Date de sortie.
- Tracklist.
- Crédits.
- Liens officiels.
- Scores et historique.
- Certifications/records uniquement avec sources.

## 10. Recherche

- Recherche instantanée avec délai anti-spam.
- Regroupement par artistes, titres, albums, genres.
- Tolérance aux accents, casse et variantes.
- Synonymes et alias artistes.
- Historique local facultatif.
- Page de résultats complète.
- État sans résultat avec suggestions.
- Journalisation agrégée des recherches sans résultat pour améliorer le catalogue.

## 11. URLs et slugs

- Slugs lisibles et stables.
- Les changements de nom conservent les anciens slugs via redirections.
- Les doublons ajoutent un suffixe stable.
- L’identifiant interne ne doit pas être exposé comme seul élément d’URL publique.

---

<!-- SOURCE: docs/04_DESIGN_SYSTEM.md -->

# 04 — Design system

## 1. Objectifs

Le design doit exprimer trois qualités : musique, données, prestige culturel. Il doit être immédiatement distinctif tout en conservant une lisibilité de média éditorial.

## 2. Tokens

### Couleurs

```css
--hmi-space-950: #030712;
--hmi-navy-900: #071B3A;
--hmi-surface-900: #0B1220;
--hmi-surface-800: #111B2E;
--hmi-blue-500: #145BFF;
--hmi-blue-400: #3A75FF;
--hmi-red-500: #E52535;
--hmi-red-400: #F14957;
--hmi-white: #F8FAFC;
--hmi-gray-300: #CBD5E1;
--hmi-gray-400: #9AA7B8;
--hmi-success: #2ECF8F;
--hmi-warning: #F4B740;
--hmi-danger: #F04452;
```

Prévoir des tokens sémantiques : background, surface, text-primary, text-secondary, border, accent, positive, negative, focus.

### Espacement

Échelle de 4 px : 4, 8, 12, 16, 24, 32, 48, 64, 96.

### Rayons

- Petit : 8 px.
- Moyen : 12 px.
- Grand : 18 px.
- Pilule : 999 px.

### Ombres

Ombres faibles. Les halos colorés sont réservés aux points focaux.

## 3. Typographie

- Display : forte, compacte, utilisée pour hero et rangs majeurs.
- Sans-serif UI : excellente lisibilité.
- Poids limités pour réduire le téléchargement.
- Chiffres tabulaires dans tableaux, scores et rangs.
- Taille minimale du corps : 16 px sur mobile.
- Longueur de ligne : 55 à 80 caractères pour les textes longs.

## 4. Composants fondamentaux

- Button : primary, secondary, ghost, destructive, icon.
- Link.
- Input, textarea, select, combobox.
- SearchBox.
- Checkbox, radio, switch.
- Dialog, drawer, popover, tooltip.
- Tabs.
- Badge.
- Avatar.
- Card.
- Skeleton.
- Toast.
- EmptyState.
- ErrorState.
- Pagination et LoadMore.
- DataTable pour admin.
- ChartRow pour classements.
- ArtistCard.
- ReleaseCard.
- MetricCard.
- TrendIndicator.
- MediaEmbed.
- SourceBadge.
- ConfidenceBadge.
- VerificationBadge.

## 5. États obligatoires

Chaque élément interactif prend en charge :

- default ;
- hover, uniquement comme amélioration ;
- focus-visible ;
- active ;
- disabled ;
- loading ;
- error ;
- selected si pertinent.

## 6. Cartes

### ArtistCard

- Ratio image cohérent.
- Nom.
- Genre principal.
- Rang ou tendance facultatif.
- Badge vérifié.
- Action favori.
- Toute la carte est accessible au clavier sans créer de liens imbriqués invalides.

### ReleaseCard

- Pochette carrée.
- Titre.
- Artiste.
- Année ou date.
- Type.
- Indicateur de tendance facultatif.

### ChartRow

Desktop : ligne dense et lisible.  
Mobile : carte horizontale avec rang très visible.

## 7. Visualisations

- Graphiques simples.
- Axes, unités et périodes explicites.
- Tooltip accessible.
- Ne jamais communiquer une hausse/baisse uniquement par couleur.
- Possibilité de voir un tableau de données.
- Pas de 3D décorative pour les données.

## 8. Univers cosmique

### Autorisé

- gradient radial léger ;
- poussière d’étoiles statique ou très lente ;
- halo derrière un artiste vedette ;
- transition de profondeur entre hero et contenu ;
- districts illustrés comme entrées éditoriales.

### Interdit

- particules massives sur toute la page ;
- texte sur fond illisible ;
- déplacement continu agressif ;
- effets WebGL obligatoires pour naviguer ;
- animation qui bloque le LCP.

## 9. Composant décoratif `StageLightsOverlay`

### 9.1 Intention

`StageLightsOverlay` installe une atmosphère « concert stage » premium autour du shell public. Il complète l’univers cosmique sans devenir l’élément principal. Il ne doit jamais masquer un texte, gêner une interaction ou augmenter fortement le coût de rendu.

### 9.2 Emplacement recommandé

```text
components/effects/StageLightsOverlay.tsx
components/effects/stage-lights-overlay.module.css
```

Le composant est monté une seule fois dans le layout public ou dans un conteneur de page explicitement prévu. Le parent crée le contexte d’empilement. L’overlay est derrière le contenu mais au-dessus du fond principal.

### 9.3 Composition visuelle

- Quatre corps de projecteurs décoratifs : haut gauche, haut droite, bas gauche, bas droite.
- Un faisceau par projecteur, orienté vers le centre ou une zone hors axe.
- Les faisceaux utilisent des gradients CSS, un masque ou `clip-path`, et une origine de transformation cohérente avec leur coin.
- Deux ou trois nappes de fumée au maximum, réalisées avec des gradients radiaux translucides.
- Opacité indicative des faisceaux : `0.05` à `0.14` selon la surface.
- Opacité indicative de la fumée : `0.025` à `0.08`.
- Les couleurs viennent de tokens : bleu électrique, rouge HMI, blanc froid. Éviter un arc-en-ciel saturé.
- La lumière ne doit pas réduire le contraste WCAG du contenu.

### 9.4 Contrat React

Le composant :

- est un composant de présentation sans état métier ;
- accepte au minimum `className?: string` ;
- peut accepter une intensité contrôlée, mais la valeur par défaut reste `subtle` ;
- rend une racine `aria-hidden="true"` ;
- ne rend aucun bouton, lien, média ou élément focusable ;
- applique `pointer-events: none` à la racine et à ses descendants ;
- ne lit pas la taille de l’écran en JavaScript pour son responsive ;
- n’utilise pas de timer React pour animer les lumières.

### 9.5 Animation

- CSS uniquement.
- Durées lentes et désynchronisées, environ 10 à 24 secondes.
- Mouvement de balayage limité, sans flash ni changement brutal d’opacité.
- Propriétés animées privilégiées : `transform` et `opacity`.
- `will-change` réservé aux quelques éléments réellement animés.
- `contain: paint` ou isolation équivalente lorsque cela évite des repaint inutiles.
- Pas de `backdrop-filter` plein écran, pas de filtre SVG complexe, pas de vidéo de fumée.

Exemples de mouvements autorisés : rotation légère du faisceau, dérive lente de la fumée, respiration très faible de l’intensité. Les animations ne doivent pas se synchroniser parfaitement afin d’éviter un mouvement mécanique.

### 9.6 Responsive

- Dimensions avec `clamp()` plutôt que des valeurs fixes uniquement desktop.
- Les quatre projecteurs restent représentés, mais leur taille, portée et opacité diminuent sur mobile.
- Aucun débordement horizontal à 320 px.
- Sur petits écrans, les faisceaux ne doivent pas traverser les zones principales de lecture avec une forte opacité.
- L’overlay respecte les safe areas et ne gêne pas les contrôles fixes.

### 9.7 Mouvement réduit et économie de données

```css
@media (prefers-reduced-motion: reduce) {
  /* aucune animation ; état statique discret ou overlay masqué */
}
```

Lorsque `prefers-reduced-motion: reduce` est actif :

- toutes les animations sont arrêtées ;
- aucun mouvement résiduel ne provient d’une transition infinie ;
- la fumée peut être masquée ;
- un halo statique de faible opacité peut subsister.

Lorsque le produit détecte un mode économie de données, la fumée est supprimée et l’effet peut être réduit à deux halos statiques ou désactivé, sans modifier la structure de la page.

### 9.8 Empilement et lisibilité

Structure recommandée :

```text
PageShell (position: relative; isolation: isolate)
├── fond
├── StageLightsOverlay (non interactif)
└── contenu (position: relative; z-index supérieur)
```

L’overlay ne doit jamais passer au-dessus des menus, dialogs, toasts, lecteurs ou éléments interactifs. Il ne doit pas créer une couche qui intercepte le scroll ou les clics.

### 9.9 Critères d’acceptation

1. Quatre projecteurs sont visibles sur une page de démonstration desktop.
2. Les faisceaux et la fumée sont animés en CSS, sans bibliothèque d’animation.
3. L’overlay et tous ses descendants ont `pointer-events: none`.
4. La racine est `aria-hidden="true"` et ne contient aucun élément focusable.
5. Le rendu est lisible à 320, 375, 768, 1024 et 1440 px sans overflow horizontal.
6. `prefers-reduced-motion: reduce` arrête toutes les animations.
7. L’effet reste subtil : aucune zone de texte critique ne perd son contraste requis.
8. Le composant n’ajoute aucun canvas, WebGL, vidéo ou dépendance lourde.
9. Un test vérifie qu’un bouton placé sous l’overlay reste cliquable.
10. L’overlay est monté au maximum une fois dans le shell public.

## 10. Accessibilité

- Niveau WCAG AA comme objectif minimal.
- Focus visible.
- Navigation clavier.
- Labels explicites.
- Alternatives textuelles.
- Sous-titres pour médias propres.
- Réduction du mouvement.
- Pas d’autoplay sonore.
- Contraste contrôlé par tests automatisés et revue manuelle.

## 11. Performance visuelle

- CSS et SVG avant canvas.
- WebGL seulement pour une expérience optionnelle et lazy-loaded.
- Images AVIF/WebP lorsque possible.
- `srcset` et tailles explicites.
- LQIP ou placeholder.
- Les animations non essentielles sont supprimées en mode économie de données.

---

<!-- SOURCE: docs/05_DATA_MODEL.md -->

# 05 — Modèle de données

## 1. Principes

- PostgreSQL est la source de vérité.
- Toutes les dates sont stockées en UTC.
- Les identifiants sont des UUID.
- Les entités publiques ont un `slug`.
- Les suppressions métier utilisent `deleted_at` lorsqu’un historique doit être conservé.
- Les snapshots de métriques et résultats de charts sont immuables.
- Toute donnée externe conserve sa source, son identifiant externe, sa date de collecte et son niveau de confiance.
- Les champs JSON sont réservés aux données semi-structurées ; les relations importantes restent normalisées.
- Les changements administratifs sensibles génèrent une entrée d’audit.

## 2. Identité et comptes

### `profiles`

- `id uuid pk` — identique à l’utilisateur Auth.
- `display_name text`
- `username citext unique nullable`
- `avatar_path text nullable`
- `bio text nullable`
- `locale text default 'fr'`
- `country_code char(2) nullable`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz nullable`

### `roles`

- `id uuid pk`
- `key text unique` : user, contributor, artist, manager, moderator, analyst, admin, super_admin.
- `name text`
- `description text`

### `user_roles`

- `user_id uuid fk profiles`
- `role_id uuid fk roles`
- `granted_by uuid nullable`
- `created_at timestamptz`
- PK composite.

### `favorites`

- `user_id`
- `entity_type` : artist, song, album.
- `entity_id`
- `created_at`
- Contrainte d’unicité utilisateur + entité.

## 3. Artistes

### `artists`

- `id uuid pk`
- `name text`
- `sort_name text`
- `slug citext unique`
- `artist_type` : solo, group, duo, orchestra, collective, dj, producer.
- `status` : draft, review, published, archived.
- `verification_status` : unverified, claimed, verified, disputed.
- `bio_short text nullable`
- `bio_long text nullable`
- `country_code char(2) nullable`
- `city text nullable`
- `formed_on date nullable`
- `disbanded_on date nullable`
- `primary_image_path text nullable`
- `cover_image_path text nullable`
- `official_website text nullable`
- `created_by uuid nullable`
- `published_at timestamptz nullable`
- `created_at`, `updated_at`, `deleted_at`

### `artist_aliases`

- `id`
- `artist_id`
- `alias`
- `alias_type` : former_name, legal_name, spelling, nickname, search.
- `is_public boolean`
- Index trigram sur alias.

### `artist_members`

Pour groupes et collectifs.

- `group_artist_id`
- `member_artist_id nullable`
- `member_name text nullable`
- `role text nullable`
- `started_on`, `ended_on`
- `is_current boolean`
- Contrainte : artiste lié ou nom libre obligatoire.

### `artist_links`

- `artist_id`
- `platform` : website, spotify, apple_music, youtube, tiktok, instagram, facebook, x, audiomack, boomplay, deezer, soundcloud, other.
- `url`
- `external_id nullable`
- `is_official`
- `verified_at nullable`

### `genres`

- `id`
- `name`
- `slug`
- `description`
- `parent_id nullable`
- `status`

### `artist_genres`

- `artist_id`
- `genre_id`
- `weight smallint`
- `is_primary boolean`

### `labels`

- `id`
- `name`
- `slug`
- `country_code`
- `website`
- `status`
- `created_at`, `updated_at`

## 4. Œuvres et sorties

### `songs`

Représente la composition/enregistrement de référence utilisé par la plateforme.

- `id`
- `title`
- `slug`
- `version_title nullable`
- `duration_seconds nullable`
- `isrc nullable`
- `explicit boolean`
- `language_codes text[]`
- `status`
- `release_date date nullable`
- `primary_cover_path nullable`
- `created_at`, `updated_at`, `deleted_at`

### `song_artists`

- `song_id`
- `artist_id`
- `credit_role` : primary, featured, remixer, producer_artist.
- `display_order`
- `credited_as nullable`

### `albums`

- `id`
- `title`
- `slug`
- `album_type` : album, ep, mixtape, single, compilation, live, soundtrack.
- `upc nullable`
- `release_date nullable`
- `label_id nullable`
- `cover_path nullable`
- `status`
- `description nullable`
- `created_at`, `updated_at`, `deleted_at`

### `album_artists`

- `album_id`
- `artist_id`
- `credit_role`
- `display_order`

### `album_tracks`

- `album_id`
- `song_id`
- `disc_number default 1`
- `track_number`
- `display_title nullable`
- `is_bonus boolean`

### `credits`

- `id`
- `entity_type` : song, album.
- `entity_id`
- `person_artist_id nullable`
- `person_name nullable`
- `role` : songwriter, composer, producer, executive_producer, engineer, mixer, mastering_engineer, musician, artwork, director, other.
- `detail nullable`
- `source_id nullable`

### `release_links`

- `entity_type`
- `entity_id`
- `platform`
- `url`
- `external_id nullable`
- `is_official`
- `verified_at nullable`

### `external_entities`

Mappe une entité HMI à une plateforme.

- `id`
- `entity_type`
- `entity_id`
- `source_id`
- `external_id`
- `canonical_url nullable`
- `metadata jsonb`
- Unicité source + external_id.

## 5. Sources et métriques

### `data_sources`

- `id`
- `key unique`
- `name`
- `source_type` : api, manual, csv, partner, editorial.
- `status` : active, degraded, disabled.
- `terms_url nullable`
- `supports_automated_collection boolean`
- `default_confidence numeric(4,3)`
- `last_success_at nullable`
- `created_at`, `updated_at`

### `metric_definitions`

- `id`
- `key unique`
- `name`
- `entity_type`
- `unit`
- `aggregation` : cumulative, period_total, point_in_time, rate.
- `higher_is_better boolean`
- `description`

Exemples : youtube_views, youtube_likes, spotify_popularity, tiktok_creations, hmi_profile_views.

### `metric_snapshots`

- `id bigserial pk`
- `entity_type`
- `entity_id`
- `source_id`
- `metric_definition_id`
- `value numeric`
- `period_start nullable`
- `period_end nullable`
- `observed_at`
- `collected_at`
- `confidence numeric(4,3)`
- `method` : api, manual, import, derived.
- `source_reference text nullable`
- `batch_id uuid nullable`
- `metadata jsonb`
- Unicité logique empêchant les doublons exacts.
- Partitionnement temporel envisageable après croissance.

### `import_batches`

- `id`
- `source_id`
- `filename`
- `checksum`
- `status`
- `rows_total`, `rows_valid`, `rows_invalid`, `rows_applied`
- `error_report_path nullable`
- `created_by`
- `created_at`, `completed_at`

### `data_quality_issues`

- `id`
- `entity_type`
- `entity_id`
- `severity`
- `issue_type`
- `description`
- `status`
- `assigned_to nullable`
- `detected_at`
- `resolved_at nullable`

## 6. Charts et scoring

### `chart_definitions`

- `id`
- `name`
- `slug unique`
- `entity_type`
- `period_type` : daily, weekly, monthly, yearly.
- `scope` : global, haiti, diaspora, genre.
- `genre_id nullable`
- `ranking_version_id`
- `status`
- `publication_schedule jsonb`
- `description`

### `ranking_versions`

- `id`
- `version text unique`
- `name`
- `formula jsonb`
- `description`
- `effective_from`
- `effective_to nullable`
- `status` : draft, active, retired.
- `created_by`
- `created_at`

### `chart_issues`

Une édition immuable d’un chart.

- `id`
- `chart_definition_id`
- `period_start`
- `period_end`
- `published_at nullable`
- `status` : calculating, review, published, failed, withdrawn.
- `ranking_version_id`
- `data_completeness numeric(4,3)`
- `confidence numeric(4,3)`
- `notes nullable`
- Unicité chart + période.

### `chart_entries`

- `id`
- `chart_issue_id`
- `entity_type`
- `entity_id`
- `rank integer`
- `score numeric`
- `previous_rank nullable`
- `peak_rank`
- `periods_on_chart`
- `movement` : new, reentry, up, down, stable.
- `score_components jsonb`
- `confidence numeric(4,3)`
- Unicité issue + rang et issue + entité.

### `chart_records`

- `id`
- `chart_definition_id`
- `entity_type`
- `entity_id`
- `record_type`
- `value numeric`
- `achieved_on`
- `source_chart_issue_id`
- `status`

## 7. Réclamations et contributions

### `artist_claims`

- `id`
- `artist_id`
- `claimant_user_id`
- `relationship` : artist, member, manager, label, representative.
- `proof_type`
- `proof_path nullable`
- `proof_notes nullable`
- `status` : draft, submitted, in_review, approved, rejected, revoked.
- `reviewed_by nullable`
- `review_notes nullable`
- `submitted_at`, `reviewed_at`

### `artist_access`

- `artist_id`
- `user_id`
- `access_role` : owner, manager, editor, analyst.
- `status`
- `granted_by`
- `created_at`, `revoked_at`

### `change_requests`

- `id`
- `requester_id`
- `entity_type`
- `entity_id`
- `request_type`
- `proposed_changes jsonb`
- `evidence jsonb`
- `status`
- `reviewed_by nullable`
- `review_notes nullable`
- `created_at`, `reviewed_at`

### `reports`

- `id`
- `reporter_id nullable`
- `entity_type`
- `entity_id`
- `reason`
- `details`
- `status`
- `created_at`, `resolved_at`

## 8. HMI Shorts

### `shorts`

- `id`
- `title`
- `description nullable`
- `provider` : youtube, tiktok, instagram, owned.
- `provider_content_id`
- `embed_url`
- `thumbnail_url nullable`
- `artist_id nullable`
- `song_id nullable`
- `rights_basis` : official_embed, artist_permission, owned_content, partner_license.
- `rights_reference nullable`
- `status` : draft, review, published, blocked, archived.
- `published_at`
- `created_by`
- `created_at`, `updated_at`

### `short_interactions`

- `short_id`
- `user_id nullable`
- `session_hash nullable`
- `interaction_type` : impression, view, complete, like, share, click_artist.
- `created_at`
- Données minimisées et rétention limitée.

## 9. Audit et système

### `audit_logs`

- `id bigserial`
- `actor_user_id nullable`
- `action`
- `entity_type`
- `entity_id nullable`
- `before jsonb nullable`
- `after jsonb nullable`
- `ip_hash nullable`
- `request_id`
- `created_at`
- Insertion seulement, jamais de mise à jour par utilisateurs ordinaires.

### `system_jobs`

- `id`
- `job_type`
- `payload jsonb`
- `status`
- `attempts`
- `max_attempts`
- `scheduled_at`
- `started_at`, `completed_at`
- `last_error nullable`
- `idempotency_key unique nullable`

## 10. Indexes essentiels

- Slugs uniques.
- Recherche trigram sur noms, titres et alias.
- Index composite snapshots : entité, métrique, source, observed_at desc.
- Chart entries : issue + rank.
- Change requests : status + created_at.
- Audit : entity_type + entity_id + created_at.
- Shorts : status + published_at.
- Claims : artist_id + status.
- Index partiels sur entités publiées et non supprimées.

## 11. RLS — principes

- Lecture publique uniquement sur entités publiées.
- Un utilisateur lit et modifie son profil.
- Un artiste accède seulement aux entités autorisées par `artist_access`.
- Les propositions artiste n’écrivent pas directement les tables publiques ; elles créent des `change_requests`.
- Les modérateurs traitent les files autorisées.
- Les admins gèrent le catalogue.
- Les opérations de scoring et imports utilisent un rôle serveur dédié.
- Les journaux d’audit ne sont pas modifiables depuis le client.

## 12. Seed

Le seed de développement contient des données fictives clairement marquées `demo`. La production reçoit :

- rôles ;
- définitions de genres ;
- définitions de métriques ;
- sources désactivées par défaut ;
- configuration de charts en brouillon ;
- aucun faux artiste présenté comme réel.

---

<!-- SOURCE: docs/06_AUTH_ROLES_AND_WORKFLOWS.md -->

# 06 — Authentification, rôles et workflows

## 1. Authentification

### Méthodes MVP

- Email + mot de passe.
- Magic link facultatif.
- OAuth Google facultatif.
- Vérification email obligatoire avant soumission sensible.
- Réinitialisation sécurisée.
- Sessions gérées par Supabase Auth.

### Exigences

- Messages d’erreur non révélateurs.
- Rate limiting.
- CAPTCHA adaptatif sur abus, pas systématique.
- Cookies sécurisés, HttpOnly lorsque applicable.
- Redirection sûre après connexion.
- Journalisation des actions sensibles.
- Possibilité de révoquer les sessions.

## 2. Rôles

### `user`

- Gérer son compte.
- Ajouter des favoris.
- Soumettre un signalement.
- Demander la revendication d’un artiste.

### `contributor`

- Proposer des données et sources.
- Voir ses propres soumissions.

### `artist`

- Accéder aux artistes accordés.
- Proposer des modifications.
- Voir des données internes autorisées.

### `manager`

- Même base que artist, potentiellement plusieurs artistes.
- Inviter des collaborateurs si autorisé.

### `moderator`

- Traiter signalements et modifications.
- Ne peut pas changer la formule de classement.
- Ne peut pas accorder super_admin.

### `analyst`

- Importer et contrôler les métriques.
- Prévisualiser un recalcul.
- Ne publie pas sans permission distincte.

### `admin`

- Catalogue, utilisateurs, modération, charts, publications.
- Actions sensibles auditées.

### `super_admin`

- Paramètres critiques, rôles, sources, secrets opérationnels via environnement.
- Rôle accordé manuellement.

## 3. Matrice simplifiée

| Action | Public | User | Artiste/Manager | Modérateur | Analyste | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Lire contenu publié | Oui | Oui | Oui | Oui | Oui | Oui |
| Favoris | Non | Oui | Oui | Oui | Oui | Oui |
| Revendiquer artiste | Non | Oui | Oui | Oui | Oui | Oui |
| Proposer modification | Non | Limité | Oui | Oui | Oui | Oui |
| Approuver modification | Non | Non | Non | Oui | Limité | Oui |
| Import métriques | Non | Non | Non | Non | Oui | Oui |
| Recalculer preview | Non | Non | Non | Non | Oui | Oui |
| Publier chart | Non | Non | Non | Non | Selon rôle | Oui |
| Gérer rôles | Non | Non | Non | Non | Non | Oui |

Les permissions réelles sont vérifiées côté serveur et par RLS ; le masquage UI ne constitue pas une sécurité.

## 4. Revendication de profil artiste

### Étapes

1. Utilisateur connecté ouvre un profil.
2. Clique « Revendiquer ce profil ».
3. Choisit sa relation.
4. Fournit une preuve :
   - email officiel ;
   - lien depuis compte social officiel ;
   - document professionnel ;
   - confirmation par un représentant déjà vérifié ;
   - autre preuve examinable.
5. Accepte les conditions.
6. Soumet.
7. Le système crée une entrée d’audit et notifie l’équipe.
8. Un modérateur vérifie.
9. En cas d’approbation, `artist_access` est créé.
10. En cas de rejet, une raison non sensible est communiquée.

### Sécurité

- Fichiers de preuve dans un bucket privé.
- URLs signées à courte durée.
- Accès limité aux reviewers.
- Politique de rétention.
- Pas de document d’identité demandé par défaut si une preuve moins intrusive suffit.
- Les revendications concurrentes déclenchent un statut disputed.

## 5. Modification d’un profil

### Champs à faible risque

Liens sociaux, bio, ville publique, photo, genres, contacts publics. Même ces champs passent par validation au MVP.

### Champs à haut risque

Nom, identité, membres, crédits, dates, propriété de sortie, ISRC/UPC, label. Validation et source obligatoires.

### Flux

- L’artiste voit la version publique.
- Il édite une copie.
- Le système génère un diff.
- Il joint des sources.
- La demande est soumise.
- Le modérateur approuve tout ou partie.
- Les changements approuvés sont appliqués dans une transaction.
- Un audit stocke avant/après.
- Une notification confirme l’issue.

## 6. Invitations d’équipe

V1.1 ou plus tard :

- Owner invite par email.
- Rôle limité par artiste.
- Invitation expirante.
- Révocation immédiate.
- Un manager ne peut pas s’accorder owner.
- Toutes les invitations sont auditées.

## 7. Suppression de compte

- Demande confirmée.
- Délai de grâce configurable.
- Retrait des données non nécessaires.
- Conservation des audits minimaux justifiés.
- Les contributions publiques peuvent être anonymisées plutôt que supprimées si nécessaire.
- Export des données personnelles disponible.

## 8. Cas d’erreur

- Email déjà utilisé.
- Lien expiré.
- Profil déjà revendiqué.
- Preuve invalide.
- Permission révoquée pendant l’édition.
- Demande concurrente.
- Entité archivée.
- Téléversement trop volumineux.
- Type de fichier interdit.
- Session expirée.

Chaque erreur possède un message utilisateur clair et un code interne traçable.

---

<!-- SOURCE: docs/07_PUBLIC_EXPERIENCE.md -->

# 07 — Expérience publique

## 1. Accueil

### Objectif

Présenter immédiatement Planet HMI et donner accès aux données les plus utiles sans imposer l’univers visuel.

### Hero

- Logo ou wordmark.
- Accroche.
- Brève phrase expliquant les charts.
- CTA « Voir les classements ».
- CTA secondaire « Découvrir les artistes ».
- Illustration cosmique légère.
- Une donnée vedette réelle, uniquement si disponible.

### Ambiance scénique globale

- Le shell public peut afficher `StageLightsOverlay` derrière le contenu.
- Les quatre projecteurs de coin, leurs faisceaux et la fumée restent décoratifs, peu opaques et non interactifs.
- L’effet est plus présent dans le hero, puis visuellement atténué dans les sections de données.
- Il ne remplace jamais une hiérarchie typographique, une illustration éditoriale ou un état de contenu.
- Il est arrêté ou statique lorsque l’utilisateur préfère réduire les mouvements.
- Il peut être désactivé sur les pages denses, dans les dashboards et dans l’administration.

### Top Charts

- 5 à 10 entrées.
- Onglets artistes/titres/albums.
- Date de l’édition.
- Lien « Voir le Top complet ».
- Aucun filtre complexe dans ce résumé.

### En ascension

- Entités dont la vitesse de croissance est élevée.
- Badge expliquant qu’il s’agit d’une tendance, pas du rang global.
- Minimum de confiance exigé.

### Nouvelles sorties

- Tri par date de sortie.
- Distinction entre date officielle et date d’ajout.
- Filtres rapides par genre.

### HMI Shorts

- 3 à 6 cartes.
- Pas d’autoplay sonore.
- Chargement de l’embed au clic ou à proximité du viewport.
- Fallback vers le lien officiel.

## 2. Charts

### Interactions

- Changement de catégorie sans perdre la période.
- URL reflétant les filtres importants.
- Partage d’une édition précise.
- Entête sticky léger sur longue liste.
- Pagination ou chargement progressif.
- Les rangs 1–3 peuvent avoir un traitement premium, mais gardent la même structure sémantique.

### Mouvement

- `+N` pour montée.
- `−N` pour baisse.
- `—` stable.
- `NEW` nouvelle entrée.
- `RE` retour.
- Texte accessible correspondant.

### Détails

Le clic ouvre la fiche de l’entité. Une expansion inline facultative peut montrer score, pic, semaines et liens d’écoute.

## 3. Profils artistes

### Hero

- Photo optimisée.
- Nom canonique.
- Badge vérifié expliqué au survol/focus.
- Genres.
- Boutons suivre/favori, partager, liens officiels.
- Requête de correction.

### Statistiques

Maximum 4 métriques principales sur mobile :

- rang actuel ;
- pic historique ;
- semaines classées ;
- score/tendance.

Les métriques non comparables ne sont pas additionnées visuellement.

### Discographie

- Filtres all, albums, EP, singles, collaborations.
- Tri récent/populaire.
- Année.
- Pagination.
- Gestion des œuvres sans pochette.

### Historique

- Courbe de rang avec axe inversé clairement expliqué.
- Sélecteur de chart.
- Résumé des records.
- Table accessible.

## 4. Recherche

### Suggestion instantanée

- Démarre après 2 caractères.
- Debounce.
- Maximum de résultats par groupe.
- Raccourcis clavier.
- Fermeture avec Escape.
- État loading discret.
- Mise en évidence sûre, sans injection HTML.

### Classement des résultats

Combinaison de :

- correspondance exacte ;
- alias ;
- popularité interne raisonnable ;
- statut publié ;
- qualité de la donnée.

Ne pas enterrer les petits artistes uniquement à cause de popularité.

## 5. HMI Shorts

### Flux

- Une carte principale par écran.
- Swipe vertical sur mobile, navigation clavier desktop.
- Métadonnées toujours visibles.
- Bouton artiste et titre.
- Partage.
- Favori.
- Signalement.
- L’embed conserve les contrôles obligatoires du fournisseur.

### Survol et aperçu

Le hover peut préparer les ressources autorisées, mais :

- ne démarre pas de son automatique ;
- ne télécharge pas toute une vidéo ;
- ne contourne pas l’autoplay ;
- ne lance pas plusieurs médias ;
- s’arrête lorsque l’élément quitte l’écran ;
- possède une alternative tactile.

### Preload intelligent

- Précharger uniquement les métadonnées et miniature de l’élément suivant.
- Charger le player après intention claire ou proximité.
- Limiter selon `saveData`, réseau lent et mémoire.
- Détruire les players éloignés.
- Un seul média actif.

## 6. Pages légales et méthodologie

### Méthodologie

- Ce que mesure HMI Score.
- Ce qu’il ne mesure pas.
- Sources disponibles.
- Périodes.
- Normalisation.
- Gestion des données manquantes.
- Changements de version.
- Contact pour correction.

### Sources

Chaque page de donnée doit afficher :

- dernière mise à jour ;
- source(s) ;
- statut vérifié/estimé ;
- lien vers la méthodologie.

## 7. Internationalisation

Architecture prête pour :

- Français.
- Kreyòl ayisyen.
- Anglais.

Le MVP peut lancer avec une langue principale, mais aucun texte critique ne doit être enfoui dans les composants de manière impossible à traduire. Les noms propres et crédits ne sont pas traduits.

---

<!-- SOURCE: docs/08_ARTIST_ADMIN_AND_MODERATION.md -->

# 08 — Dashboard artiste, administration et modération

## 1. Dashboard artiste

### Accueil

- Artiste sélectionné.
- Statut de vérification.
- Résumé des demandes.
- Dernières statistiques disponibles.
- Alertes de données.
- CTA pour compléter le profil.

### Profil

- Formulaire par sections.
- Indicateur de complétude.
- Aperçu public.
- Sauvegarde de brouillon.
- Diff avant soumission.
- Sources requises pour champs sensibles.

### Sorties

- Liste des sorties liées.
- Bouton proposer une sortie.
- Détection de doublons par titre/date/identifiant.
- Association à un album.
- Ajout de crédits.
- Liens officiels.
- Statut de revue.

### Analytics

- Données internes de Planet HMI.
- Positions et évolution.
- Trafic agrégé.
- Sources externes seulement si autorisées.
- Période et date visibles.
- Export CSV en V1.1.

### Demandes

- Brouillon.
- Soumise.
- En revue.
- Besoin d’informations.
- Approuvée.
- Partiellement approuvée.
- Rejetée.

## 2. Dashboard admin

### Vue d’ensemble

- Demandes en attente.
- Réclamations.
- Imports récents.
- Échecs de collecte.
- Charts à publier.
- Problèmes de qualité.
- Activité sensible récente.

### Catalogue

Fonctions :

- recherche et filtres ;
- création ;
- édition ;
- fusion de doublons ;
- archivage ;
- aperçu public ;
- historique ;
- validation de slugs ;
- gestion des relations.

### Fusion de doublons

Opération sensible :

1. Choisir entité canonique.
2. Prévisualiser liens transférés.
3. Détecter conflits.
4. Demander confirmation forte.
5. Exécuter transaction.
6. Conserver redirection ancien slug.
7. Audit complet.
8. Possibilité de restauration administrative limitée.

## 3. Modération

### File

- Priorité.
- Type.
- Âge de la demande.
- Risque.
- Entité.
- Demandeur.
- Conflits.
- Assignation.

### Vue de revue

- Donnée actuelle.
- Donnée proposée.
- Diff champ par champ.
- Sources.
- Historique.
- Actions : approuver, approuver partiellement, demander information, rejeter.
- Note interne et message utilisateur séparés.

### SLA internes suggérés

- Erreur critique de nom/attribution : priorité haute.
- Revendication : moyenne/haute.
- Bio ou image : moyenne.
- Suggestion générale : normale.

## 4. Imports

### Formats

CSV UTF-8 avec modèle téléchargeable.

### Processus

1. Upload privé.
2. Calcul checksum.
3. Détection doublon.
4. Parsing.
5. Validation ligne par ligne.
6. Prévisualisation.
7. Mapping des colonnes.
8. Résumé des changements.
9. Application transactionnelle par lots.
10. Rapport d’erreurs.
11. Audit.

### Principes

- Aucun import ne publie automatiquement sans option et permission explicites.
- Les identifiants externes sont privilégiés pour rapprochement.
- Les rapprochements ambigus restent en revue.
- Un batch est réexécutable sans duplication.

## 5. Gestion des charts

- Créer définition.
- Choisir formule active.
- Lancer dry-run.
- Comparer avec édition précédente.
- Voir données manquantes et anomalies.
- Verrouiller édition.
- Soumettre pour revue.
- Publier.
- Retirer avec motif sans effacer l’historique.

## 6. Gestion HMI Shorts

- Coller URL officielle.
- Valider fournisseur.
- Récupérer métadonnées via méthode autorisée.
- Associer artiste/titre.
- Choisir justification de droits.
- Prévisualiser embed.
- Publier/planifier.
- Bloquer si contenu retiré.
- Ne jamais télécharger automatiquement le média source.

## 7. Audit

Actions obligatoirement auditées :

- changement de rôle ;
- revendication approuvée/rejetée ;
- publication ou retrait ;
- changement de formule ;
- import appliqué ;
- fusion ;
- suppression/archivage ;
- modification de données sensibles ;
- accès à une preuve privée ;
- action de sécurité.

## 8. Séparation des pouvoirs

Idéalement :

- l’analyste prépare les données ;
- le modérateur valide les corrections ;
- l’admin publie le chart ;
- le super_admin change les rôles critiques.

Au MVP, une même personne peut cumuler des rôles, mais les actions restent distinctes et auditées.

---

<!-- SOURCE: docs/09_RANKING_ENGINE.md -->

# 09 — Moteur HMI Score et classements

## 1. Finalité

Le HMI Score mesure une performance observée pendant une période. Il ne mesure ni le talent, ni la valeur culturelle, ni la qualité artistique. La formule doit être :

- documentée ;
- versionnée ;
- reproductible ;
- résistante aux données manquantes ;
- difficile à manipuler ;
- révisable sans réécrire l’histoire.

## 2. Objets classables

- Artistes.
- Titres.
- Albums.
- Tendances distinctes du classement principal.
- Charts par genre si le volume de données est suffisant.

Chaque type possède sa propre formule. On ne compare pas directement le score d’un artiste à celui d’un titre.

## 3. Fenêtre temporelle

### Hebdomadaire

- Période standardisée, par exemple vendredi 00:00 UTC à jeudi 23:59:59 UTC.
- Publication après délai de validation.
- Les snapshots doivent couvrir une part suffisante de la période.

### Mensuelle et annuelle

- Calculées à partir de périodes normalisées ou d’agrégats vérifiés.
- Éviter de simplement additionner des scores hebdomadaires si la formule a changé.

## 4. Sources possibles

Catégories, selon disponibilité autorisée :

- streaming audio ;
- vidéo officielle ;
- création/usage short-form ;
- radio ou partenaires ;
- engagement sur Planet HMI ;
- ventes ou téléchargements fournis par partenaires ;
- signaux éditoriaux séparés, jamais cachés dans le score principal.

Une source n’est activée que si sa collecte est légitime, stable et documentée.

## 5. Pipeline

1. Collecter les snapshots.
2. Valider les formats.
3. Dédupliquer.
4. Marquer les anomalies.
5. Calculer les deltas par période.
6. Évaluer la couverture.
7. Normaliser par métrique.
8. Appliquer les poids de la version.
9. Calculer pénalités et confiance.
10. Générer un dry-run.
11. Comparer à l’édition précédente.
12. Revue.
13. Verrouillage.
14. Publication immuable.

## 6. Normalisation

Les métriques de volume sont fortement asymétriques. Utiliser une transformation logarithmique avant une normalisation robuste.

Exemple conceptuel :

```text
x_log = log1p(max(0, delta))
normalized = robust_percentile(x_log, population_eligible)
```

Le percentile robuste produit une valeur de 0 à 100. Les paramètres exacts sont stockés dans `ranking_versions.formula`.

### Population éligible

Une entité est éligible si :

- elle est publiée ;
- elle a une identité non ambiguë ;
- elle atteint le seuil minimal de données ;
- elle n’est pas sous sanction de fraude ;
- la période est valide.

## 7. Formule titre v1 proposée

Formule provisoire, configurable :

- Audio streaming : 35 %.
- Vidéo officielle : 30 %.
- Short-form autorisé : 15 %.
- Vitesse de croissance : 10 %.
- Engagement HMI : 5 %.
- Stabilité/qualité des données : 5 %.

```text
raw_score =
  0.35 * audio_component +
  0.30 * video_component +
  0.15 * short_form_component +
  0.10 * velocity_component +
  0.05 * hmi_engagement_component +
  0.05 * quality_component
```

La composante qualité ne doit pas récompenser artificiellement une œuvre ; elle sert surtout à limiter l’impact de données faibles. Une alternative préférable est de calculer le score sans qualité puis de multiplier par un facteur de confiance plafonné. La décision finale doit être validée par dry-runs.

## 8. Formule artiste v1 proposée

Agrégation pondérée des œuvres et traction directe :

- Performance des meilleurs titres actifs : 55 %.
- Profondeur du catalogue actif : 15 %.
- Vidéo/chaînes officielles : 10 %.
- Croissance : 10 %.
- Engagement HMI : 5 %.
- Continuité : 5 %.

Limiter la domination d’un catalogue très volumineux :

- top N titres avec décroissance ;
- plafond sur profondeur ;
- pas de somme brute de toutes les œuvres.

## 9. Formule album v1 proposée

- Performance agrégée des pistes, plafonnée : 60 %.
- Performance de l’album comme entité : 20 %.
- Croissance : 10 %.
- Engagement HMI : 5 %.
- Continuité : 5 %.

## 10. Vitesse

Exemple :

```text
velocity = current_period_delta / max(previous_period_delta, floor)
```

La valeur est winsorisée pour empêcher les ratios extrêmes sur petite base. Une nouvelle sortie peut recevoir un traitement « new release » distinct au lieu d’un ratio trompeur.

## 11. Données manquantes

### Règles

- Ne jamais convertir automatiquement « absent » en zéro.
- Distinguer zéro réel, non collecté, non applicable et erreur.
- Calculer la couverture par source.
- Réallouer les poids seulement selon une règle documentée.
- Si la couverture est insuffisante, empêcher publication ou marquer l’édition « faible confiance ».

### Options de formule

- `strict` : toutes les composantes essentielles obligatoires.
- `renormalized` : poids redistribués parmi composantes disponibles, avec pénalité.
- `fallback` : formule secondaire explicitement nommée.

Le mode utilisé est stocké avec l’édition.

## 12. Confiance

Score de 0 à 1 fondé sur :

- couverture temporelle ;
- nombre de sources ;
- fiabilité des sources ;
- cohérence des snapshots ;
- absence d’anomalies ;
- fraîcheur.

Badges publics possibles :

- Haute confiance : ≥ 0,85.
- Confiance moyenne : 0,65–0,849.
- Données limitées : < 0,65.

Les seuils restent configurables et documentés.

## 13. Anti-manipulation

Détecter :

- pics incompatibles avec l’historique ;
- répétitions anormales de requêtes HMI ;
- trafic automatisé ;
- votes coordonnés ;
- incohérences inter-sources ;
- croissance massive sans signal complémentaire ;
- imports manuels sans preuve.

Mesures :

- exclure engagement HMI suspect ;
- mettre l’entité en revue ;
- conserver les données brutes ;
- appliquer une pénalité uniquement après règle documentée ;
- journaliser la décision ;
- permettre une contestation.

## 14. Votes communautaires

Les votes servent aux Battles, prix du public ou sondages. Ils ne doivent pas influencer secrètement HMI Charts.

Si un chart communautaire existe, il porte un nom explicite et une méthode séparée.

## 15. Historique et mouvements

Pour chaque nouvelle édition :

- `previous_rank` vient de la dernière édition publiée comparable ;
- `peak_rank` est le meilleur rang historique ;
- `periods_on_chart` compte les éditions où l’entité est présente ;
- `new` si jamais classée ;
- `reentry` si déjà classée mais absente de l’édition précédente ;
- mouvement calculé, jamais saisi manuellement.

## 16. Validation avant publication

Bloquer ou avertir si :

- couverture sous seuil ;
- top 10 change de façon extrême ;
- source majeure absente ;
- doublon d’entité ;
- score identique non départagé ;
- rang manquant ;
- version de formule inactive ;
- période chevauchante ;
- dry-run non approuvé.

## 17. Départage

Ordre suggéré :

1. score non arrondi ;
2. confiance ;
3. composante principale ;
4. croissance ;
5. rang précédent ;
6. identifiant stable uniquement comme dernier départage technique.

## 18. Transparence publique

Publier :

- version de formule ;
- familles de signaux ;
- poids généraux ;
- période ;
- seuil de confiance ;
- date de mise à jour ;
- historique des changements.

Ne pas publier les mécanismes anti-fraude détaillés au point de faciliter leur contournement.

## 19. Tests du moteur

- reproductibilité ;
- invariance à l’ordre d’entrée ;
- comportement avec zéros ;
- données manquantes ;
- valeurs extrêmes ;
- nouvelles sorties ;
- reentry ;
- égalités ;
- changement de version ;
- absence de source ;
- idempotence ;
- snapshots retardés ;
- double exécution du job.

---

<!-- SOURCE: docs/10_INTEGRATIONS_AND_MEDIA.md -->

# 10 — Intégrations, médias et collecte

## 1. Principe général

Toute intégration doit respecter :

- conditions de service ;
- quotas ;
- droits d’affichage ;
- règles d’attribution ;
- restrictions de cache ;
- politique de confidentialité ;
- mécanisme de suppression.

L’absence d’API publique ne justifie pas le scraping ou le contournement.

## 2. Interface d’adaptateur

Chaque source implémente conceptuellement :

```ts
interface DataSourceAdapter {
  key: string;
  healthCheck(): Promise<SourceHealth>;
  resolveEntity(input: ResolveInput): Promise<ResolveResult>;
  fetchMetrics(input: MetricsInput): Promise<MetricRecord[]>;
  fetchMetadata(input: MetadataInput): Promise<ExternalMetadata>;
}
```

Tous les adaptateurs :

- retournent des données normalisées ;
- conservent les identifiants bruts ;
- gèrent les quotas ;
- exposent les erreurs typées ;
- sont testables avec fixtures ;
- n’écrivent pas directement dans les tables publiques.

## 3. Modes de source

### API

Collecte automatique officielle.

### Partner

Flux fourni contractuellement.

### CSV

Import manuel validé.

### Manual

Saisie manuelle avec source et preuve.

### Editorial

Information qualitative, exclue du score quantitatif sauf chart explicitement éditorial.

## 4. Plateformes envisagées

- YouTube.
- Spotify.
- Apple Music.
- Deezer.
- Audiomack.
- Boomplay.
- TikTok.
- Instagram.
- SoundCloud.
- Facebook.

L’activation réelle dépend de l’accès et des droits. Chaque connecteur commence désactivé et possède un mode mock pour développement.

## 5. Embeds

### Autorisés

- Player ou embed officiel.
- oEmbed officiel lorsque disponible.
- Contenu fourni par l’artiste.
- Média détenu/licencié par Planet HMI.

### Exigences

- Conserver branding et contrôles obligatoires.
- Ne pas masquer les liens du fournisseur.
- Respecter les cookies/consentements.
- Lazy-load.
- Fallback vers URL officielle.
- Ne pas extraire le flux média.
- Ne pas tenter d’éviter les publicités ou restrictions.
- Retirer rapidement un contenu devenu indisponible.

## 6. Extraits audio

Le MVP ne doit pas héberger d’extraits de morceaux commerciaux sans autorisation. Les options valides sont :

- preview fourni officiellement ;
- embed de plateforme ;
- fichier envoyé par ayant droit avec consentement ;
- contenu original Planet HMI ;
- contrat de licence.

Modifier pitch, tempo ou BPM ne supprime pas les droits et n’est pas une stratégie acceptée.

## 7. Préchargement intelligent

### Règles réseau

- `saveData` : aucun preload lourd.
- Réseau lent : miniatures seulement.
- Wi-Fi/rapide : preload des métadonnées, jamais du média complet sans besoin.
- Précharger maximum un élément suivant.
- Annuler les requêtes hors viewport.

### Règles player

- Un seul player actif.
- Pause lors du changement d’onglet si approprié.
- Détruire les iframes lointaines.
- Conserver la position uniquement si le fournisseur et l’UX le permettent.
- Aucun son au simple hover.

## 8. Images

### Sources

- Upload artiste autorisé.
- Presse/label avec droit.
- API autorisée.
- Image par défaut.

### Pipeline

- Validation MIME réelle.
- Limite de taille.
- Antivirus si disponible.
- Suppression métadonnées sensibles.
- Conversion optimisée.
- Plusieurs tailles.
- Champ alt.
- Crédit et source.
- Bucket public seulement pour versions publiées.

## 9. Jobs de collecte

Chaque job :

- possède une idempotency key ;
- limite sa concurrence ;
- respecte le rate limit ;
- utilise backoff ;
- stocke l’erreur ;
- n’efface pas le dernier snapshot valide ;
- mesure latence et réussite ;
- peut être relancé.

## 10. Résolution d’identité

Un même artiste peut avoir plusieurs IDs externes. La résolution utilise :

- identifiant officiel ;
- URL officielle ;
- nom + alias ;
- label/manager ;
- correspondance de catalogue ;
- revue humaine en cas d’ambiguïté.

Ne jamais fusionner automatiquement deux artistes uniquement sur la similarité du nom.

## 11. Provenance

Toute métrique affiche en interne :

- source ;
- méthode ;
- observé à ;
- collecté à ;
- référence ;
- batch ;
- confiance.

Les pages publiques montrent une version simplifiée.

## 12. Suppression et conformité

Lorsqu’un contenu intégré est retiré :

- marquer indisponible ;
- ne pas casser la page ;
- proposer les autres liens officiels ;
- purger les caches selon les règles ;
- conserver l’historique de chart sans republier le média.

---

<!-- SOURCE: docs/11_SECURITY_PRIVACY_PERFORMANCE.md -->

# 11 — Sécurité, confidentialité, performance et SEO

## 1. Modèle de menace

Risques principaux :

- prise de contrôle de compte ;
- élévation de privilèges ;
- modification frauduleuse de profils ;
- injection de données ;
- uploads malveillants ;
- spam de revendications ;
- manipulation des votes/engagements ;
- fuite de preuves privées ;
- scraping massif des données ;
- abus des intégrations ;
- XSS via embeds ou contenu riche ;
- erreurs de configuration RLS ;
- secrets exposés.

## 2. Contrôles de sécurité

### Auth

- Email vérifié.
- MFA recommandé pour admin.
- Réauthentification pour actions critiques.
- Révocation des sessions.
- Alertes de connexion suspecte si disponible.

### Autorisation

- Vérification serveur.
- RLS testée.
- Principe du moindre privilège.
- Rôles séparés.
- Aucun rôle transmis par le client n’est fiable.

### Entrées

- Zod.
- Requêtes paramétrées.
- Nettoyage du contenu riche.
- Liste blanche pour URLs d’embed.
- Validation des slugs.
- Taille maximale.

### Uploads

- MIME réel.
- Extensions autorisées.
- Buckets privés/publics séparés.
- Noms générés.
- URLs signées.
- Scan.
- Quotas.

### HTTP

- CSP.
- HSTS.
- Referrer-Policy.
- Permissions-Policy.
- X-Content-Type-Options.
- Protection CSRF selon architecture.
- CORS minimal.

## 3. Secrets

- Variables d’environnement.
- Aucun secret côté client.
- Rotation.
- Environnements séparés.
- Clés de service limitées aux jobs serveurs.
- Logs sans tokens.

## 4. Privacy

### Minimisation

Collecter uniquement ce qui est nécessaire.

### Données sensibles

Les preuves de revendication sont privées, à accès restreint et rétention limitée.

### Analytics

- Consentement selon juridiction.
- IP anonymisée ou hachée à courte rétention.
- Pas de vente de données personnelles.
- Pas de fingerprinting caché.

### Droits

- Accès.
- Correction.
- Suppression.
- Export.
- Contact clair.

## 5. Journaux

- Logs structurés.
- Request ID.
- Pas de mots de passe, tokens ou documents.
- Masquage emails selon contexte.
- Rétention adaptée.
- Audit séparé des logs techniques.

## 6. Performance

### Budgets indicatifs

- JS initial public limité.
- LCP cible inférieur à 2,5 s sur mobile raisonnable.
- CLS inférieur à 0,1.
- INP inférieur à 200 ms dans des conditions normales.
- Images principales prioritaires.
- Fonts auto-hébergées ou optimisées.

### Techniques

- Server Components.
- Streaming SSR.
- Cache par page/donnée.
- Revalidation contrôlée.
- CDN images.
- Pagination.
- Virtualisation seulement si nécessaire.
- Dynamic import pour graphiques, embeds et cosmique.
- Bundle analysis en CI périodique.

### Connexions limitées

- Design utilisable sans vidéo.
- Miniatures compressées.
- Mode réduction données.
- Pas de WebGL par défaut sur appareils faibles.
- Retry manuel.
- Messages hors ligne.

## 7. Cache

- Pages publiques : cache avec revalidation.
- Données de chart publiées : longues durées, car immuables.
- Édition courante : revalidation à publication.
- Pages admin : no-store.
- Réponses utilisateur : privées.
- Purge ciblée après publication.

## 8. SEO

### Technique

- Rendu serveur.
- URLs canoniques.
- Sitemap segmenté.
- Robots.
- Métadonnées Open Graph.
- Données structurées adaptées à MusicGroup, MusicRecording, MusicAlbum, BreadcrumbList lorsque valides.
- Pagination indexable de façon contrôlée.
- Redirections de slugs.

### Contenu

- Titres et descriptions uniques.
- Biographies originales ou autorisées.
- Pages minces non indexées.
- Sources.
- Dates de mise à jour.
- Alt text.

### Multilingue

- `hreflang` lorsque traductions réelles.
- Pas de traduction automatique publiée sans revue pour les contenus éditoriaux importants.

## 9. Disponibilité et sauvegarde

- Sauvegardes automatiques base.
- Test de restauration.
- Export périodique des données critiques.
- Runbook incident.
- Page de statut facultative.
- Mode lecture seule en incident d’écriture.

## 10. Observabilité

Mesurer :

- erreurs serveur/client ;
- latence ;
- taux de cache ;
- succès des jobs ;
- quota sources ;
- imports invalides ;
- échecs auth ;
- publications ;
- anomalies score.

Alertes :

- panne source majeure ;
- job critique échoué ;
- taux d’erreur élevé ;
- tentative de permission anormale ;
- espace stockage ;
- migration échouée.

---

<!-- SOURCE: docs/12_TESTING_AND_ACCEPTANCE.md -->

# 12 — Tests, qualité et critères d’acceptation

## 1. Pyramide

### Unitaires

- normalisation ;
- score ;
- mouvements ;
- validation ;
- permissions ;
- helpers de slugs ;
- mapping adaptateurs ;
- formatage.

### Intégration

- repositories avec base de test ;
- RLS ;
- création de change request ;
- application d’import ;
- publication de chart ;
- auth ;
- uploads ;
- jobs idempotents.

### E2E

- visite accueil et chart ;
- recherche ;
- inscription ;
- favoris ;
- revendication ;
- modification artiste ;
- modération ;
- import ;
- dry-run/publish chart ;
- HMI Shorts et fallback.

## 2. Tests RLS obligatoires

Pour chaque table sensible :

- anonyme ;
- user propriétaire ;
- autre user ;
- artiste autorisé ;
- artiste non autorisé ;
- modérateur ;
- admin ;
- rôle service.

Tester lecture, insertion, update et delete.

## 3. Accessibilité

- axe automatisé.
- Navigation clavier manuelle.
- Focus.
- Lecteur d’écran sur parcours critiques.
- Zoom 200 %.
- Réduction de mouvement.
- Contraste.
- Messages d’erreur associés aux champs.

## 4. Responsive

Largeurs minimales à vérifier :

- 320 px.
- 375 px.
- 768 px.
- 1024 px.
- 1440 px.

Ne pas créer des snapshots visuels fragiles pour toute la page ; cibler les composants structurants.

## 5. Navigateurs

- Chrome/Edge modernes.
- Safari moderne.
- Firefox moderne.
- Safari iOS.
- Chrome Android.

Dégradation progressive pour fonctions avancées.

## 6. Performance CI

- Build.
- Typecheck.
- Lint.
- Tests unitaires.
- Tests intégration ciblés.
- Playwright smoke.
- Vérification migrations.
- Analyse de dépendances vulnérables.
- Vérification secrets.
- Budget bundle sur routes principales.

## 7. Données de test

- Fixtures fictives.
- Aucun document personnel réel.
- Sources simulées.
- Cas accents et noms créoles.
- Doublons.
- collaborations multiples.
- artistes homonymes.
- titres identiques.
- dates partielles.
- données manquantes.
- extrêmes.

## 8. Critères globaux

Une feature publique est acceptée si :

- URL stable.
- SEO minimal.
- loading/empty/error.
- mobile.
- clavier.
- erreurs journalisées.
- permissions.
- tests.
- aucune fausse donnée.
- contenu légalement affichable.

Une feature admin est acceptée si :

- audit.
- confirmation des actions destructrices.
- filtrage/pagination.
- messages clairs.
- protection contre double soumission.
- rollback ou stratégie de récupération.
- permission côté serveur.
- tests RLS.

## 9. Critères spécifiques

### Chart

- ordre déterministe ;
- aucun rang dupliqué ;
- édition immuable après publication ;
- mouvement correct ;
- date visible ;
- méthode accessible ;
- niveau de confiance ;
- partage d’URL.

### Profil artiste

- nom, image fallback, genres, liens ;
- discographie ;
- correction ;
- source/date ;
- aucun champ privé ;
- redirection ancien slug.

### Claim

- preuve privée ;
- statut ;
- notification ;
- audit ;
- pas d’accès avant approbation ;
- gestion conflit.

### Import

- preview ;
- erreurs par ligne ;
- pas de duplication au retry ;
- journal ;
- transaction ;
- fichier privé.

### `StageLightsOverlay`

- quatre projecteurs présents dans les coins aux largeurs desktop ;
- rendu responsive sans overflow à 320 px ;
- `aria-hidden="true"` et aucun élément focusable ;
- `pointer-events: none` vérifié sur la racine et les descendants ;
- interaction possible avec les boutons, liens et champs placés sous l’overlay ;
- aucune animation lorsque `prefers-reduced-motion: reduce` est simulé ;
- aucun canvas, WebGL, vidéo ou bibliothèque d’animation ajouté ;
- animations limitées à des propriétés performantes ;
- contraste des zones de contenu contrôlé avec l’effet actif ;
- absence de duplication de l’overlay dans le DOM du shell public.

### Shorts

- provider autorisé ;
- un seul player ;
- pas d’autoplay sonore ;
- fallback ;
- signalement ;
- droits documentés.

## 10. Definition of Done

- Code relu.
- Tests passent.
- Migrations testées.
- Documentation.
- Aucun TODO critique.
- Erreurs connues consignées.
- Feature flag si incomplète.
- Observabilité.
- Acceptance validée.

---

<!-- SOURCE: docs/13_DEPLOYMENT_AND_OPERATIONS.md -->

# 13 — Déploiement et exploitation

## 1. Environnements

- Local.
- Preview par pull request.
- Staging.
- Production.

Chaque environnement possède :

- projet Supabase distinct ou isolation forte ;
- secrets distincts ;
- buckets distincts ;
- URLs d’auth propres ;
- sources externes en sandbox si possible.

## 2. Branches

- `main` déployable.
- Branches courtes.
- Pull request obligatoire pour changements structurants.
- Migration accompagnée d’un plan de rollback.

## 3. Pipeline

1. Install verrouillé.
2. Lint.
3. Typecheck.
4. Unit tests.
5. Integration tests.
6. Build.
7. Security checks.
8. Preview deployment.
9. E2E smoke.
10. Approval.
11. Production.
12. Smoke post-deploy.

## 4. Migrations

- Forward-only de préférence.
- Compatibilité temporaire lors de changements risqués.
- Sauvegarde avant migration critique.
- Pas de migration destructive automatique en production.
- Backfill séparé.
- Index lourds créés de manière adaptée.
- Validation sur staging avec volume représentatif.

## 5. Feature flags

Utiliser pour :

- nouvelle formule ;
- nouvelle source ;
- HMI Shorts ;
- fonctionnalité artist dashboard ;
- nouvelle expérience cosmique ;
- charts non publics.

Les flags critiques sont côté serveur.

## 6. Runbooks

Créer des runbooks pour :

- source externe en panne ;
- chart erroné ;
- compte admin compromis ;
- fuite de preuve ;
- import incorrect ;
- migration échouée ;
- média litigieux ;
- trafic massif ;
- erreur de cache.

## 7. Publication d’un chart

1. Collecte close.
2. Validation données.
3. Dry-run.
4. Revue anomalies.
5. Validation analyste.
6. Validation publication.
7. Création édition immuable.
8. Invalidation cache.
9. Génération sitemap/métadonnées si nécessaire.
10. Vérification page.
11. Annonce.

## 8. Retrait

Si un chart contient une erreur :

- ne pas réécrire silencieusement ;
- marquer retiré ;
- publier correction avec note ;
- conserver audit ;
- rediriger vers édition corrigée si approprié.

## 9. Coûts

Le MVP privilégie :

- fonctions serverless raisonnables ;
- images optimisées ;
- jobs planifiés peu fréquents ;
- cache agressif des éditions ;
- pas de vidéo hébergée ;
- pas de temps réel inutile ;
- mesures de quotas.

Créer un tableau mensuel : base, stockage, egress, fonctions, logs, emails, erreurs, APIs.

## 10. Maintenance

Hebdomadaire :

- santé jobs ;
- sources ;
- demandes ;
- erreurs ;
- sauvegardes.

Mensuel :

- coûts ;
- dépendances ;
- permissions ;
- qualité données ;
- pages orphelines ;
- SEO ;
- incidents.

Trimestriel :

- exercice restauration ;
- revue formule ;
- audit des rôles ;
- revue de confidentialité ;
- roadmap.

---

<!-- SOURCE: docs/14_ROADMAP.md -->

# 14 — Roadmap de construction

## Phase 0 — Fondation

- Initialiser dépôt.
- Configurer Next.js/TypeScript/Tailwind.
- Configurer Supabase.
- CI.
- Environnements.
- Design tokens.
- Layout.
- Tests.
- Observabilité.
- ADR initiales.

Sortie : shell fonctionnel, déployé en preview.

## Phase 1 — Catalogue

- Schéma artistes.
- Genres.
- Titres.
- Albums.
- Crédits.
- Liens.
- Admin CRUD.
- Recherche interne.
- Upload images.

Sortie : équipe capable de construire un catalogue propre.

## Phase 2 — Public Core

- Accueil.
- Artistes.
- Titres.
- Albums.
- Genres.
- Recherche publique.
- SEO.
- Sitemap.
- Favoris.

Sortie : plateforme éditoriale utilisable sans charts automatisés.

## Phase 3 — Claims

- Auth complète.
- Revendication.
- Preuves privées.
- Artist access.
- Dashboard.
- Change requests.
- Modération.
- Audit.

Sortie : artistes capables de contribuer sous contrôle.

## Phase 4 — Data

- Sources.
- Metrics.
- Imports.
- Snapshots.
- Quality issues.
- Jobs.
- Monitoring.

Sortie : pipeline de données fiable.

## Phase 5 — HMI Charts

- Ranking version.
- Score engine.
- Dry-runs.
- Validation.
- Publication.
- History.
- Public chart pages.
- Methodology.

Sortie : premier chart officiel reproductible.

## Phase 6 — HMI Shorts

- Registry providers.
- Validation embed.
- Admin.
- Public feed.
- Preload intelligent.
- Rights basis.
- Reporting.

Sortie : découverte verticale conforme.

## Phase 7 — Polish

- Internationalisation.
- Performance.
- Accessibilité.
- Design cosmique avancé optionnel.
- Analytics.
- Notifications.
- Records.

## Phase 8 — V2

- Battles.
- Awards.
- Événements.
- Comparaisons.
- Rapports premium.
- API publique.
- Partenariats.

## Ordre strict des dépendances

Ne pas construire :

- les charts avant le modèle de données ;
- le score avant les snapshots ;
- l’accès artiste avant permissions/RLS ;
- HMI Shorts avant règles de droits ;
- les animations lourdes avant performance et contenu réel.

## Jalons de validation

### Jalon A

Le catalogue et l’admin fonctionnent.

### Jalon B

Les pages publiques sont indexables.

### Jalon C

Les artistes peuvent revendiquer sans obtenir d’accès indu.

### Jalon D

Un import réel produit des snapshots auditables.

### Jalon E

Un chart peut être recalculé à l’identique.

### Jalon F

Le lancement public est sécurisé et observable.

---

<!-- SOURCE: .kiro/specs/foundation/requirements.md -->

# Foundation — Requirements

## Introduction

Cette spec crée la fondation technique, visuelle et opérationnelle de Planet HMI. Elle ne doit pas encore implémenter l’ensemble du produit.

## R1 — Initialisation

**WHEN** le dépôt est installé, **THE SYSTEM SHALL** démarrer localement avec une commande documentée.

### Acceptance Criteria

1. TypeScript strict est activé.
2. Le build réussit.
3. Lint et format sont configurés.
4. Les variables nécessaires sont documentées dans `.env.example`.
5. Aucun secret réel n’est versionné.

## R2 — Structure

**THE SYSTEM SHALL** séparer routes publiques, authentifiées, dashboard et admin.

### Acceptance Criteria

1. Les dossiers suivent `tech.md`.
2. Les imports utilisent des alias.
3. Les modules de domaine ne dépendent pas de l’UI.
4. Une page 404 et une boundary d’erreur existent.

## R3 — Design system

**THE SYSTEM SHALL** fournir les tokens et composants fondamentaux de Planet HMI.

### Acceptance Criteria

1. Palette sémantique.
2. Typographie et chiffres tabulaires.
3. Button, Input, Card, Badge, Skeleton, EmptyState et ErrorState.
4. Focus visible.
5. Reduced motion.
6. Story/demo route interne ou documentation des variantes.
7. Composant décoratif `StageLightsOverlay` avec quatre projecteurs de coin, faisceaux CSS et fumée légère.
8. L’overlay est non interactif, responsive, subtil, performant et compatible `prefers-reduced-motion`.

## R4 — Layout public

**WHEN** un visiteur ouvre l’application, **THE SYSTEM SHALL** afficher un shell responsive avec navigation, recherche placeholder et footer.

### Acceptance Criteria

1. Mobile 320 px sans overflow.
2. Navigation clavier.
3. Skip link.
4. Header sticky non bloquant.
5. Footer avec liens légaux placeholders.
6. Hero de démonstration sans fausse métrique.

## R5 — Supabase

**THE SYSTEM SHALL** intégrer Supabase de manière sécurisée.

### Acceptance Criteria

1. Clients navigateur et serveur séparés.
2. Session SSR supportée.
3. Migration initiale versionnée.
4. RLS activée sur tables applicatives.
5. Seed de développement fictif.
6. Connexion non requise pour pages publiques.

## R6 — Auth de base

**WHEN** un utilisateur s’inscrit ou se connecte, **THE SYSTEM SHALL** créer ou charger son profil applicatif.

### Acceptance Criteria

1. Inscription email.
2. Connexion.
3. Déconnexion.
4. Mot de passe oublié.
5. Vérification email.
6. Route account protégée.
7. Erreurs sans fuite d’information.

## R7 — Observabilité

**THE SYSTEM SHALL** produire des logs structurés et capturer les erreurs inattendues.

### Acceptance Criteria

1. Request ID.
2. Logger serveur.
3. Redaction de secrets.
4. Error boundary client.
5. Intégration de suivi configurable par environnement.

## R8 — CI

**WHEN** une pull request est ouverte, **THE SYSTEM SHALL** exécuter les contrôles de qualité.

### Acceptance Criteria

1. Install lockfile.
2. Lint.
3. Typecheck.
4. Unit tests.
5. Build.
6. Scan secrets de base.
7. Échec du pipeline en cas d’erreur.

## R9 — SEO de base

**THE SYSTEM SHALL** fournir les métadonnées globales et les fichiers techniques SEO.

### Acceptance Criteria

1. Metadata title template.
2. Description.
3. Open Graph par défaut.
4. Robots.
5. Sitemap minimal.
6. Langue du document.

## R10 — Performance

**THE SYSTEM SHALL** limiter le JavaScript client initial et lazy-loader les éléments lourds.

### Acceptance Criteria

1. Server Components par défaut.
2. Pas de bibliothèque d’animation lourde sans justification.
3. Image principale optimisée.
4. Fonts optimisées.
5. Aucun embed chargé sur la page initiale.

---

<!-- SOURCE: .kiro/specs/foundation/design.md -->

# Foundation — Technical Design

## 1. Architecture

Application Next.js full-stack avec App Router. Les pages publiques privilégient les Server Components. Supabase fournit PostgreSQL, Auth et Storage.

## 2. Routes initiales

```text
app/
  (public)/
    page.tsx
    charts/page.tsx
    artists/page.tsx
  (auth)/
    login/page.tsx
    signup/page.tsx
    forgot-password/page.tsx
  account/page.tsx
  admin/page.tsx
  layout.tsx
  not-found.tsx
  error.tsx
```

Les pages charts/artists sont des états de construction honnêtes ou utilisent des fixtures uniquement en développement, jamais de faux classement public.

## 3. Modules

```text
lib/config
lib/supabase
lib/auth
lib/permissions
lib/validation
lib/observability
components/ui
components/layout
```

## 4. Base initiale

Tables :

- profiles
- roles
- user_roles
- audit_logs

Triggers :

- création de profil après création auth, ou fonction serveur idempotente.
- updated_at.

RLS :

- profiles publics limités aux champs prévus via vue publique ou lecture restreinte.
- utilisateur modifie son profil.
- rôles non modifiables par utilisateur.
- audit insertion via serveur seulement.

## 5. Auth

- Middleware uniquement pour rafraîchir session et protéger les zones générales.
- L’autorisation fine reste dans les actions/services.
- Les redirections sont validées contre une liste interne.
- Admin route vérifie rôle côté serveur.

## 6. Design

Créer tokens CSS dans le thème Tailwind/CSS variables. Les composants doivent rester compatibles avec mode sombre. Le thème cosmique initial est CSS seulement.


Créer également `components/effects/StageLightsOverlay.tsx` avec un module CSS dédié :

- quatre projecteurs dans les coins du shell public ;
- faisceaux et fumée réalisés sans JavaScript d’animation ;
- racine `aria-hidden="true"` et `pointer-events: none` ;
- tailles responsive via CSS et aucune mesure de viewport dans React ;
- animations lentes basées sur `transform` et `opacity` ;
- media query `prefers-reduced-motion: reduce` supprimant toute animation ;
- contenu public placé dans un niveau d’empilement supérieur ;
- un seul overlay monté dans le layout public ;
- tests d’interaction sous-jacente et de réduction du mouvement.

Le composant ne doit utiliser ni canvas, ni WebGL, ni vidéo, ni bibliothèque d’animation. Il peut être masqué sur les interfaces d’administration et les pages de données très denses.

## 7. Error model

```ts
type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";
```

Les messages internes ne sont pas exposés en production.

## 8. Tests

- Unit : validation, permissions, helpers.
- Integration : profil, RLS si environnement de test disponible.
- E2E smoke : accueil, login, route protégée.
- A11y smoke sur accueil et login.

## 9. ADR

Créer :

- ADR-001 stack.
- ADR-002 Supabase/RLS.
- ADR-003 Server Components.
- ADR-004 stratégie média autorisé.

---

<!-- SOURCE: .kiro/specs/foundation/tasks.md -->

# Foundation — Implementation Tasks

- [ ] 1. Initialiser le projet, TypeScript strict, lockfile, lint, format et `.env.example`.
- [ ] 2. Créer la structure de dossiers et les alias.
- [ ] 3. Implémenter les tokens du design system et les composants UI fondamentaux.
- [ ] 4. Implémenter `StageLightsOverlay` avec quatre projecteurs de coin, faisceaux CSS, fumée légère, responsive, `pointer-events: none`, reduced motion et tests ciblés.
- [ ] 5. Construire le layout public responsive, header, navigation mobile, skip link et footer.
- [ ] 6. Configurer Supabase clients serveur/navigateur et la gestion SSR de session.
- [ ] 7. Créer les migrations initiales `profiles`, `roles`, `user_roles`, `audit_logs` avec RLS.
- [ ] 8. Implémenter inscription, connexion, déconnexion, vérification et mot de passe oublié.
- [ ] 9. Protéger `/account` et `/admin` avec vérifications serveur.
- [ ] 10. Ajouter logging structuré, request ID, error boundaries et redaction.
- [ ] 11. Ajouter métadonnées, robots et sitemap minimal.
- [ ] 12. Configurer tests unitaires, intégration et Playwright smoke.
- [ ] 13. Configurer la CI complète.
- [ ] 14. Créer ADR-001 à ADR-004.
- [ ] 15. Exécuter lint, typecheck, tests, build et corriger tous les échecs.
- [ ] 16. Documenter installation, variables, migrations, seed et déploiement preview.

---

<!-- SOURCE: .kiro/specs/mvp-core/requirements.md -->

# MVP Core — Requirements

## Introduction

Cette spec implémente le catalogue, les pages publiques, les charts, la revendication et le back-office MVP. Elle commence seulement lorsque Foundation est terminée.

## R1 — Catalogue artiste

**WHEN** un admin crée ou modifie un artiste, **THE SYSTEM SHALL** valider les données, conserver l’historique sensible et publier uniquement les entités approuvées.

Acceptance :

- CRUD.
- Slug stable.
- Alias.
- Genres.
- Liens officiels.
- Images.
- Statut draft/review/published/archived.
- Audit.

## R2 — Catalogue musical

**THE SYSTEM SHALL** gérer titres, albums, tracklists, artistes et crédits.

Acceptance :

- Collaborations multiples.
- Ordre d’affichage.
- ISRC/UPC facultatifs mais uniques lorsqu’utilisés.
- Types de sorties.
- Liens officiels.
- Détection de doublons.

## R3 — Pages publiques

**WHEN** une entité est publiée, **THE SYSTEM SHALL** générer une page publique SSR avec SEO, sources, états et responsive.

Acceptance :

- Artist.
- Song.
- Album.
- Genre.
- Fallback image.
- 404 non publié.
- Ancien slug redirigé.

## R4 — Recherche

**WHEN** une personne recherche au moins deux caractères, **THE SYSTEM SHALL** retourner artistes, titres et albums pertinents sans exposer de brouillons.

Acceptance :

- Accents.
- Alias.
- Pagination.
- Debounce client.
- Rate limit.
- No result state.
- Logs agrégés.

## R5 — Favoris

**WHEN** un utilisateur connecté ajoute un favori, **THE SYSTEM SHALL** le conserver de façon idempotente et privée.

## R6 — Claims

**WHEN** un utilisateur soumet une revendication, **THE SYSTEM SHALL** protéger les preuves, suivre le statut et empêcher tout accès avant approbation.

## R7 — Change requests

**WHEN** un artiste autorisé propose une modification, **THE SYSTEM SHALL** créer un diff modérable au lieu de changer directement la donnée publique.

## R8 — Administration

**THE SYSTEM SHALL** fournir des files de catalogue, claims, modifications, imports, sources et charts.

## R9 — Imports métriques

**WHEN** un analyste importe un CSV valide, **THE SYSTEM SHALL** prévisualiser, valider, appliquer de façon idempotente et produire un rapport.

## R10 — Ranking

**WHEN** les données d’une période sont suffisantes, **THE SYSTEM SHALL** calculer un dry-run déterministe selon une version de formule.

Acceptance :

- Score components.
- Confidence.
- Missing data handling.
- Movement.
- Tie-break.
- Anomaly warnings.
- No publication automatique.

## R11 — Publication chart

**WHEN** un admin publie un dry-run approuvé, **THE SYSTEM SHALL** créer une édition immuable, invalider le cache et rendre la page partageable.

## R12 — HMI Shorts

**WHEN** un admin ajoute une URL d’un fournisseur autorisé, **THE SYSTEM SHALL** valider l’embed et publier sans réhéberger le média.

Acceptance :

- Rights basis.
- One active player.
- No sound autoplay.
- Lazy loading.
- Fallback.
- Report.

## R13 — Internationalisation

**THE SYSTEM SHALL** externaliser les textes UI pour permettre français, créole et anglais, même si toutes les traductions ne sont pas lancées au MVP.

## R14 — Qualité

Toutes les features satisfont les critères de `docs/12_TESTING_AND_ACCEPTANCE.md`.

---

<!-- SOURCE: .kiro/specs/mvp-core/design.md -->

# MVP Core — Technical Design

## 1. Domain modules

```text
lib/domain/artists
lib/domain/music
lib/domain/catalog
lib/domain/claims
lib/domain/moderation
lib/domain/metrics
lib/domain/ranking
lib/domain/shorts
lib/domain/search
```

Chaque module contient types, schemas, services, repositories et tests.

## 2. Database

Implémenter le modèle de `docs/05_DATA_MODEL.md` par migrations incrémentales. Commencer par catalogue, puis claims, métriques, charts et shorts.

Utiliser des vues publiques lorsque cela réduit le risque d’exposer des champs administratifs.

## 3. Admin

Routes server-rendered. Tables paginées. Actions via Server Actions ou endpoints protégés. Toute action sensible exige :

- permission serveur ;
- validation ;
- transaction ;
- audit ;
- message résultat ;
- idempotence si double soumission possible.

## 4. Search

PostgreSQL :

- `unaccent`.
- `pg_trgm`.
- indexes GIN/trigram.
- requête pondérée exacte/prefix/alias/fuzzy.
- filtre `status = published`.

Une interface repository permet un remplacement futur par moteur dédié.

## 5. Images

Uploads privés en brouillon. Après validation, copie ou promotion vers chemin public. Conserver credit/source/alt.

## 6. Claims

Les preuves restent dans bucket privé. Le frontend ne reçoit que des URLs signées courtes pour reviewers autorisés.

## 7. Metrics import

Pipeline séparé :

- parse ;
- schema validation ;
- resolve entity ;
- preview ;
- apply.

Stocker checksum et batch. Les métriques utilisent decimal/numeric, jamais float pour calcul critique.

## 8. Ranking

Fonctions pures :

```text
calculateDelta
normalizeMetric
calculateCoverage
calculateConfidence
calculateEntityScore
rankEntities
calculateMovement
```

La formule est chargée depuis une version active validée. Une publication copie les composants et le score dans chart_entries.

## 9. Cache

- Catalogue public revalidé à publication.
- Chart issues immuables cache long.
- Search court cache ou no-store selon personnalisation.
- Admin no-store.
- User private.

## 10. HMI Shorts

Registre de providers avec whitelist de domaines et constructeur d’embed. Ne jamais rendre directement un HTML externe non nettoyé.

## 11. SEO

Générer metadata à partir des entités. JSON-LD uniquement avec données réelles. Sitemap paginé/segmenté après volume.

## 12. Feature flags

- public_charts
- artist_claims
- artist_dashboard
- hmi_shorts
- cosmic_effects
- i18n_secondary_languages

## 13. Tests

Réutiliser matrice de `docs/12_TESTING_AND_ACCEPTANCE.md`. Ajouter tests de propriété ou jeux de données générés pour ranking.

---

<!-- SOURCE: .kiro/specs/mvp-core/tasks.md -->

# MVP Core — Implementation Tasks

## Catalogue

- [ ] 1. Créer migrations artistes, alias, genres, liens, labels.
- [ ] 2. Créer migrations titres, albums, associations, tracklists, crédits et liens.
- [ ] 3. Ajouter RLS et vues publiques.
- [ ] 4. Implémenter services/repositories catalogue.
- [ ] 5. Construire admin artistes.
- [ ] 6. Construire admin titres/albums.
- [ ] 7. Ajouter upload image sécurisé.
- [ ] 8. Ajouter fusion doublons et redirections de slugs.

## Public

- [ ] 9. Construire page artistes et profil artiste.
- [ ] 10. Construire pages titre et album.
- [ ] 11. Construire pages genres.
- [ ] 12. Construire accueil alimenté uniquement par données réelles publiées.
- [ ] 13. Implémenter SEO, JSON-LD et sitemap catalogue.
- [ ] 14. Implémenter recherche globale et suggestions.
- [ ] 15. Implémenter favoris.

## Claims et dashboard

- [ ] 16. Créer migrations claims, artist_access, change_requests et reports.
- [ ] 17. Construire parcours de revendication et stockage privé des preuves.
- [ ] 18. Construire file de revue des claims.
- [ ] 19. Construire dashboard artiste.
- [ ] 20. Construire propositions de modification avec diff.
- [ ] 21. Construire modération et application transactionnelle.
- [ ] 22. Tester toutes les permissions et RLS.

## Data et charts

- [ ] 23. Créer migrations sources, métriques, snapshots, imports et qualité.
- [ ] 24. Construire import CSV preview/apply idempotent.
- [ ] 25. Construire admin sources et métriques.
- [ ] 26. Créer migrations ranking versions, chart definitions, issues et entries.
- [ ] 27. Implémenter fonctions pures de normalisation, confiance, score et mouvement.
- [ ] 28. Implémenter dry-run et détection d’anomalies.
- [ ] 29. Construire workflow review/publish/withdraw.
- [ ] 30. Construire pages charts et historique.
- [ ] 31. Construire page méthodologie.
- [ ] 32. Tester reproductibilité, valeurs extrêmes, données manquantes et double exécution.

## Shorts

- [ ] 33. Créer migrations shorts et interactions minimisées.
- [ ] 34. Implémenter registre de fournisseurs et validation whitelist.
- [ ] 35. Construire admin Shorts avec rights basis.
- [ ] 36. Construire flux public, lazy loading et un seul player.
- [ ] 37. Ajouter fallback, signalement et reduced data mode.

## Finalisation

- [ ] 38. Externaliser tous les textes UI.
- [ ] 39. Exécuter audit accessibilité.
- [ ] 40. Exécuter audit performance.
- [ ] 41. Exécuter audit sécurité/RLS.
- [ ] 42. Configurer sauvegarde, alertes et runbooks.
- [ ] 43. Supprimer fixtures de production.
- [ ] 44. Exécuter test E2E complet.
- [ ] 45. Valider les critères de lancement du MVP.
