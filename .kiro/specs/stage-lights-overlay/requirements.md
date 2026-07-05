# Requirements Document

## Introduction

Cette fonctionnalité raffine l'effet décoratif de « lumières de scène » (StageLightsOverlay) présent uniquement sur la page d'accueil (`index.html`) de Planète HMI. L'objectif est de recréer une ambiance de scène de concert premium, immersive et cinématographique, tout en restant subtile, élégante et performante. L'effet repose sur quatre projecteurs placés dans les coins, chacun émettant une source lumineuse discrète, un halo, un faisceau conique dirigé vers le centre, ainsi qu'une fumée décorative légère.

L'implémentation doit respecter la stack actuelle du projet : un site statique HTML/CSS/JS vanilla, sans build tooling, sans React, sans TypeScript et sans lint/type-check/tests configurés (conformément au steering `tech.md`). L'overlay `.stage-lights` déjà présent dans `index.html` et dans `assets/css/style.css` doit être **raffiné et étendu**, jamais dupliqué : il ne doit exister qu'un seul overlay par page.

L'API conceptuelle du composant (`intensity`, `showSmoke`, `variant`) est exposée dans la stack statique via des attributs `data-*` sur le conteneur `.stage-lights`, et l'équivalent React/Next.js est documenté uniquement pour préparer une future migration, sans être introduit maintenant.

Cette fonctionnalité inclut également un correctif de mise en page : l'image de fond cosmique ne doit pas être appliquée au hero, mais placée derrière la planète (couche `.cosmos`), afin de restaurer la hiérarchie visuelle prévue.

## Glossary

- **Page_Accueil**: La page `index.html` de Planète HMI, seule page où l'effet StageLightsOverlay s'applique.
- **StageLightsOverlay**: Le conteneur décoratif `.stage-lights` regroupant les quatre projecteurs, leurs halos, leurs faisceaux et la fumée.
- **Projecteur**: Une source lumineuse d'angle composée d'une source discrète, d'un halo et d'un faisceau conique/trapézoïdal. Quatre projecteurs sont prévus : haut-gauche, haut-droit, bas-gauche, bas-droit.
- **Faisceau**: Le cône/trapèze de lumière semi-transparent émis par un Projecteur, orienté vers le centre de la page.
- **Halo**: La zone lumineuse floue et diffuse entourant la source d'un Projecteur.
- **Fumee_Decorative**: Les nappes de gradient flou (2 à 3) simulant une fumée de scène animée lentement.
- **Couche_Cosmos**: La couche décorative `.cosmos` de la Page_Accueil contenant le fond spatial et le PNG `planet-foreground`.
- **Contenu_Hero**: Le bloc de contenu principal du hero (logo, titre, slogan, boutons d'action).
- **Tokens_CSS**: Les variables CSS définies dans `assets/css/style.css` (par exemple `--electric`, `--electric-2`, `--flame-red`, `--cream`).
- **Attribut_API**: Un attribut `data-*` placé sur le conteneur `.stage-lights` exposant un paramètre de configuration (`data-intensity`, `data-smoke`, `data-variant`).
- **Mouvement_Reduit**: L'état déclenché par la préférence utilisateur `prefers-reduced-motion: reduce`.
- **Systeme**: L'ensemble du code HTML/CSS statique implémentant le StageLightsOverlay et les couches associées.

## Requirements

### Requirement 1: Rendu des quatre projecteurs (desktop)

**User Story:** En tant que visiteur sur écran desktop, je veux voir quatre projecteurs de scène dans les coins de la page d'accueil, afin de ressentir une ambiance de concert immersive.

#### Acceptance Criteria

1. WHERE l'écran a une largeur supérieure ou égale à 861px, THE Systeme SHALL afficher quatre Projecteurs positionnés respectivement en haut-gauche, haut-droit, bas-gauche et bas-droit de la Page_Accueil.
2. THE Systeme SHALL composer chaque Projecteur d'une source lumineuse discrète, d'un Halo et d'un Faisceau conique ou trapézoïdal.
3. THE Systeme SHALL orienter chaque Faisceau vers le centre de la Page_Accueil.
4. THE Systeme SHALL maintenir un unique StageLightsOverlay sur la Page_Accueil.

### Requirement 2: Couleurs et opacités via tokens

**User Story:** En tant que responsable de l'identité visuelle, je veux des couleurs et opacités contrôlées et cohérentes avec la charte, afin de conserver un rendu premium et jamais criard.

#### Acceptance Criteria

1. THE Systeme SHALL colorer les Projecteurs, Halos et Faisceaux uniquement avec des teintes de bleu électrique, bleu cyan, rouge profond, magenta très léger et blanc froid.
2. THE Systeme SHALL dériver les couleurs des Tokens_CSS existants de `assets/css/style.css` lorsque des tokens correspondants existent.
3. THE Systeme SHALL appliquer aux Faisceaux une opacité comprise entre 0.08 et 0.22 inclus.
4. THE Systeme SHALL appliquer aux Halos une opacité comprise entre 0.10 et 0.30 inclus.
5. THE Systeme SHALL appliquer à la Fumee_Decorative une opacité comprise entre 0.04 et 0.12 inclus.
6. THE Systeme SHALL utiliser des couleurs non saturées à pleine intensité pour tous les éléments du StageLightsOverlay.

### Requirement 3: Animations lentes et désynchronisées

**User Story:** En tant que visiteur, je veux un mouvement de lumière lent et naturel, afin d'obtenir un effet vivant sans distraction ni scintillement.

#### Acceptance Criteria

1. THE Systeme SHALL animer chaque Faisceau exclusivement via les propriétés CSS `transform` et `opacity`.
2. THE Systeme SHALL attribuer à chaque animation de Faisceau une durée comprise entre 8s et 18s inclus.
3. THE Systeme SHALL utiliser une fonction de temporisation `ease-in-out` et une itération `infinite` pour les animations des Projecteurs et de la Fumee_Decorative.
4. THE Systeme SHALL attribuer à chaque Projecteur une durée d'animation et une direction de mouvement distinctes afin qu'aucun Projecteur ne soit synchronisé avec un autre.
5. THE Systeme SHALL combiner une rotation douce et un balayage dans le mouvement de chaque Faisceau.

### Requirement 4: Fumée décorative

**User Story:** En tant que visiteur, je veux une légère fumée de scène, afin de renforcer l'atmosphère de concert de manière subtile.

#### Acceptance Criteria

1. WHERE l'Attribut_API `data-smoke` a la valeur `true`, THE Systeme SHALL afficher la Fumee_Decorative composée de 2 à 3 nappes de gradient flou.
2. THE Systeme SHALL animer la Fumee_Decorative lentement via les propriétés CSS `transform` et `opacity`.
3. WHERE l'Attribut_API `data-smoke` a la valeur `false`, THE Systeme SHALL masquer la Fumee_Decorative.

### Requirement 5: Lisibilité du contenu et non-obstruction

**User Story:** En tant que visiteur, je veux que le logo, le titre, le slogan et les boutons restent parfaitement lisibles, afin de pouvoir comprendre et utiliser la page.

#### Acceptance Criteria

1. THE Systeme SHALL positionner le StageLightsOverlay derrière le Contenu_Hero.
2. THE Systeme SHALL conserver le Contenu_Hero lisible en ne recouvrant pas le logo, le titre, le slogan et les boutons par des zones lumineuses opaques.
3. WHEN un visiteur clique sur un bouton ou un lien du Contenu_Hero, THE Systeme SHALL transmettre l'interaction à l'élément cible sans interception par le StageLightsOverlay.

### Requirement 6: Accessibilité

**User Story:** En tant qu'utilisateur de technologies d'assistance ou de navigation au clavier, je veux que l'effet décoratif soit ignoré, afin de naviguer sans obstacle.

#### Acceptance Criteria

1. THE Systeme SHALL appliquer l'attribut `aria-hidden="true"` au conteneur du StageLightsOverlay.
2. THE Systeme SHALL appliquer `pointer-events: none` au StageLightsOverlay et à ses éléments enfants.
3. THE Systeme SHALL exclure tout élément focusable du StageLightsOverlay.

### Requirement 7: Respect de prefers-reduced-motion

**User Story:** En tant qu'utilisateur sensible au mouvement, je veux que les animations soient désactivées, afin d'éviter tout inconfort visuel.

#### Acceptance Criteria

1. WHILE Mouvement_Reduit est actif, THE Systeme SHALL arrêter toutes les animations des Projecteurs et des Faisceaux.
2. WHILE Mouvement_Reduit est actif, THE Systeme SHALL masquer la Fumee_Decorative.
3. WHILE Mouvement_Reduit est actif, THE Systeme SHALL afficher une version statique du StageLightsOverlay à opacité réduite.
4. WHILE Mouvement_Reduit est actif, THE Systeme SHALL présenter le StageLightsOverlay sans effet de clignotement.

### Requirement 8: Responsive et absence de scrollbar horizontale

**User Story:** En tant que visiteur mobile ou tablette, je veux un effet adapté à mon écran, afin de conserver une expérience fluide sans défilement horizontal indésirable.

#### Acceptance Criteria

1. THE Systeme SHALL dimensionner les Projecteurs, Halos et Faisceaux à l'aide de la fonction CSS `clamp()` pour l'adaptation responsive.
2. WHEN la Page_Accueil est affichée à une largeur de 320px, 375px, 390px ou 430px, THE Systeme SHALL éviter l'apparition d'une barre de défilement horizontale.
3. WHERE l'écran a une largeur inférieure ou égale à 560px, THE Systeme SHALL réduire le nombre de Projecteurs affichés à 2 lorsque quatre Projecteurs nuisent à la lisibilité ou aux performances.

### Requirement 9: Hiérarchie de superposition (z-index)

**User Story:** En tant que concepteur, je veux un empilement de couches maîtrisé, afin que chaque élément visuel reste à sa place.

#### Acceptance Criteria

1. THE Systeme SHALL empiler les couches dans l'ordre croissant de z-index suivant : fond spatial, puis étoiles/Couche_Cosmos, puis StageLightsOverlay, puis Contenu_Hero, puis navigation et boutons.
2. THE Systeme SHALL placer le StageLightsOverlay dans un conteneur positionné (`position: relative`) lui-même positionné en `absolute` ou `fixed`, derrière le contenu.

### Requirement 10: Techniques autorisées et interdites

**User Story:** En tant que responsable des performances, je veux que l'effet reste léger, afin de préserver la fluidité et la consommation de ressources.

#### Acceptance Criteria

1. THE Systeme SHALL implémenter le StageLightsOverlay uniquement avec des gradients CSS, des pseudo-éléments, `transform`, `opacity`, un `filter: blur()` modéré, et `will-change` lorsque utile.
2. THE Systeme SHALL implémenter le StageLightsOverlay sans canvas, sans WebGL, sans Three.js, sans vidéo, sans GIF et sans bibliothèque d'animation externe.
3. THE Systeme SHALL animer le StageLightsOverlay sans intervalle JavaScript permanent.
4. THE Systeme SHALL animer le StageLightsOverlay sans déclencher de reflow de mise en page (en se limitant aux propriétés `transform` et `opacity`).

### Requirement 11: API de configuration via attributs data

**User Story:** En tant que développeur, je veux configurer l'overlay via des attributs sur le conteneur, afin de reproduire l'API conceptuelle du composant dans la stack statique.

#### Acceptance Criteria

1. THE Systeme SHALL exposer l'Attribut_API `data-intensity` acceptant les valeurs `subtle` et `medium`.
2. THE Systeme SHALL exposer l'Attribut_API `data-smoke` acceptant les valeurs `true` et `false`.
3. THE Systeme SHALL exposer l'Attribut_API `data-variant` acceptant les valeurs `hero` et `full-page`.
4. WHERE aucun Attribut_API n'est spécifié sur le StageLightsOverlay de la Page_Accueil, THE Systeme SHALL appliquer les valeurs par défaut `data-intensity="subtle"`, `data-smoke="true"` et `data-variant="hero"`.
5. WHEN l'Attribut_API `data-intensity` vaut `medium`, THE Systeme SHALL augmenter l'intensité lumineuse tout en respectant les bornes d'opacité définies au Requirement 2.

### Requirement 12: Décision de stack

**User Story:** En tant que mainteneur, je veux conserver la stack statique existante, afin de rester conforme au steering technique et de préparer une migration ultérieure sans dette.

#### Acceptance Criteria

1. THE Systeme SHALL implémenter la fonctionnalité en HTML et CSS statiques conformément au steering `tech.md`.
2. THE Systeme SHALL ne pas introduire React, TypeScript ni bibliothèque de build dans le cadre de cette fonctionnalité.
3. THE Systeme SHALL documenter l'équivalent conceptuel du composant React `StageLightsOverlay` (props `className`, `intensity`, `showSmoke`, `variant`) en vue d'une future migration Next.js, sans l'implémenter.

### Requirement 13: Portée limitée à la page d'accueil

**User Story:** En tant que concepteur, je veux limiter l'effet à la page d'accueil, afin de préserver la sobriété des autres pages.

#### Acceptance Criteria

1. THE Systeme SHALL afficher le StageLightsOverlay uniquement sur la Page_Accueil.
2. THE Systeme SHALL ne pas afficher le StageLightsOverlay sur les pages tableau de bord, administration et toute autre page du site.

### Requirement 14: Raffinement de l'overlay existant (non-régression)

**User Story:** En tant que mainteneur, je veux étendre l'overlay existant sans casser l'existant, afin de préserver le design déjà en place.

#### Acceptance Criteria

1. THE Systeme SHALL raffiner et étendre le conteneur `.stage-lights` existant plutôt que d'en créer un second.
2. THE Systeme SHALL préserver le fonctionnement du Contenu_Hero, de la Couche_Cosmos et du contenu de la Page_Accueil après le raffinement.
3. THE Systeme SHALL conserver le design existant de la Page_Accueil sans le remplacer.

### Requirement 15: Correction du fond derrière la planète

**User Story:** En tant que concepteur, je veux que l'image de fond cosmique soit placée derrière la planète et non sur le hero, afin de restaurer la profondeur visuelle prévue.

#### Acceptance Criteria

1. THE Systeme SHALL retirer l'image de fond cosmique appliquée au bloc `.hero`.
2. THE Systeme SHALL placer l'image de fond cosmique dans la Couche_Cosmos, derrière le PNG `planet-foreground`.
3. THE Systeme SHALL empiler l'image de fond cosmique à un z-index inférieur à celui du PNG `planet-foreground`.
