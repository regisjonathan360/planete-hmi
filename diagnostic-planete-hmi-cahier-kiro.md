# Diagnostic Planete HMI et cahier des charges Kiro

Date de l'audit : 7 juillet 2026  
Site audite : https://planete-hmi-4eqk.vercel.app

## 1. Synthese executive

Planete HMI a une identite visuelle forte et memorable. L'univers club, galaxie, neon et musique haitienne fonctionne tres bien pour une plateforme culturelle. Le site donne envie de scroller, les pages principales existent, les favoris et la boutique demo repondent en bureau, et la page Classements contient une base methodologique interessante.

Le site n'est pas encore pret pour une mise en production publique sans corrections. Les problemes prioritaires sont :

- Menu mobile ouvert en permanence et impossible a fermer correctement.
- Bouton Connexion casse sur les pages internes, avec destination `index.html#connexion` qui retourne une 404.
- Deux boutons favoris identiques dans l'en-tete.
- Plusieurs liens morts dans le footer et les paginations.
- Dates futures affichees alors que l'audit est realise le 7 juillet 2026.
- Tri artiste "Nom (A->Z)" qui change la valeur du select mais ne trie pas la liste.
- Recherche globale qui retourne des resultats Deezer peu pertinents pour l'univers HMI.
- Images artistes et produits trop souvent remplacees par les memes placeholders.

Verdict : bon prototype visuel, mais il faut une passe de stabilisation UX/fonctionnelle avant MVP.

## 2. Tests effectues

### Environnements

- Bureau : 1280 x 720.
- Mobile : 390 x 844.
- Pages testees : accueil, artistes, classements, actualites, evenements, boutique, sous-pages classements.

### Parcours testes

- Navigation principale : Accueil, Artistes, Classements, Actualites, Evenements, Boutique.
- Menu mobile.
- Recherche globale.
- Recherche locale artistes.
- Tri artistes.
- Ajout et consultation favoris.
- Extraits audio.
- Boutique : ajout panier demo.
- Liens de footer.
- Liens des pages Classements.
- Ancre Connexion et CTA "Creer un compte", "Revendiquer mon profil".
- Console navigateur : aucune erreur bloquante detectee.

## 3. Diagnostic fonctionnel

### P0 - Bloquants

1. Menu mobile visible des le chargement

Sur mobile, le menu est ouvert par defaut sous l'en-tete. Le clic sur le bouton hamburger ne ferme pas le panneau. Resultat : le premier ecran est encombre, le hero est repousse et certains clics se melangent avec la navigation.

Attendu :
- Menu ferme par defaut.
- Hamburger ouvre le menu.
- Bouton de fermeture ou second clic hamburger ferme le menu.
- Clic sur un lien ferme le menu apres navigation.
- Le menu ne doit jamais bloquer les interactions hors menu quand il est ferme.

2. Connexion casse sur pages internes

Sur les pages internes, le bouton `CONNEXION` pointe vers `index.html#connexion`. Sur Vercel, cette URL affiche une 404.

Attendu :
- Remplacer par `/login`, `/connexion`, ou `/#connexion` selon la strategie.
- Si l'authentification n'existe pas encore, remplacer le libelle par "Rejoindre" ou "S'inscrire" et pointer vers une vraie section.

3. CTA compte/profil sans vrai parcours

Les CTA "CREER UN COMPTE" et "REVENDIQUER MON PROFIL" menent a l'ancre `#connexion`, qui affiche seulement une section d'appel a l'action. Il n'y a pas de formulaire, pas de modal, pas de flux compte, pas de demande artiste.

Attendu :
- Creer deux parcours distincts :
  - inscription utilisateur,
  - revendication profil artiste.
- Chaque parcours doit avoir ses champs, validations, et etats succes/erreur.

4. Dates futures dans les classements

Le site affiche des dates posterieures au 7 juillet 2026, par exemple :
- "Publie le 13 juillet 2026".
- "Mis a jour le 13 juillet 2026".
- semaines allant jusqu'au 10 juillet 2026.

Attendu :
- Ne jamais afficher de date future sauf contenu planifie clairement marque.
- Ajouter une regle de validation des donnees datees.

### P1 - Importants

5. Deux boutons favoris identiques

Deux coeurs "Mes favoris" apparaissent dans l'en-tete, sur bureau et mobile. Ils ont le meme role et affichent le meme compteur.

Attendu :
- Un seul bouton favoris.
- Compteur unique.
- Meme position et comportement sur toutes les pages.

6. Favoris fonctionnels en bureau, bloques par le mobile

En bureau, l'ajout de Roody Roodboy aux favoris fonctionne et le panneau affiche bien l'artiste. En mobile, le menu ouvert en permanence empeche un test fiable.

Attendu :
- Meme cycle fonctionnel en mobile et bureau.
- Ajouter, retirer, ouvrir la liste, jouer un extrait depuis la liste.
- Etat vide clair.

7. Recherche globale peu pertinente

La recherche globale accepte "Roody", mais retourne d'abord des resultats Deezer generiques comme "The Box - Roddy Ricch" au lieu de prioriser Roody Roodboy.

Attendu :
- Resultats internes HMI en priorite : artistes, titres, articles, evenements.
- Deezer seulement en second niveau, clairement separe.
- Message d'etat : chargement, aucun resultat, erreur API.

8. Overlay recherche duplique

Deux inputs de recherche et deux overlays visibles/invisibles existent dans le DOM. La fermeture peut demander deux clics si un champ contient du texte.

Attendu :
- Une seule instance active.
- Bouton "x" dans le champ efface le texte.
- Bouton "Fermer" ferme l'overlay.
- `Escape` ferme l'overlay.

9. Tri artiste non fonctionnel

La selection "Nom (A->Z)" change la valeur du select mais garde la liste dans l'ordre initial.

Attendu :
- Tri par popularite, nom A-Z, nouveautes reellement applique.
- Tests automatiques sur l'ordre des premiers artistes.

10. Filtres visuels non interactifs

Sur plusieurs pages, les filtres "Tous", "Konpa / Compas", "Rap kreyol", "Vinyles", "T-shirts", etc. ressemblent a des boutons mais ne sont pas exposes comme actions interactives visibles dans l'audit.

Attendu :
- Si ce sont des filtres : utiliser `button` ou liens avec etat actif.
- Si ce sont seulement des tags : les rendre visuellement moins interactifs.

11. Boutique demo incomplete

Le bouton "AJOUTER AU PANIER" affiche bien un toast "Ajoute au panier (demo)", mais :
- le toast est duplique dans le DOM,
- aucun panier n'est visible,
- aucun compteur panier,
- aucun retrait d'article,
- aucun parcours checkout.

Attendu MVP :
- Soit assumer "boutique vitrine" et remplacer le bouton par "Voir le produit" ou "Bientot disponible".
- Soit implementer un vrai mini-panier demo avec compteur, liste, retrait, total.

12. Liens morts

Le footer contient plusieurs liens `#` :
- reseaux sociaux,
- Methodologie,
- A propos,
- Contact,
- Confidentialite,
- Conditions,
- Droits d'auteur.

Les paginations "2", "3", "->" sur artistes et actualites pointent aussi vers `#`.

Attendu :
- Remplacer par vraies routes.
- Ou masquer les liens non disponibles.
- Ou afficher une modal "bientot disponible" seulement si c'est assumé.

13. Billets et rappel evenement sans destination

Les boutons "BILLETS" et "RAPPEL" sur Evenements pointent vers `#`.

Attendu :
- Lien billetterie externe, page evenement, ou formulaire d'interet.
- Le rappel doit demander un email ou creer un etat local clair.

### P2 - Ameliorations

14. Extraits audio : retour utilisateur insuffisant

Les boutons lecture ont une reaction visuelle, mais il n'y a pas de lecteur persistant, de pause claire, de progression, ni de titre de piste en cours.

Attendu :
- Etat lecture/pause accessible.
- Mini-player sticky avec titre artiste, titre morceau, play/pause, progression.
- Gestion des erreurs Deezer.

15. Page Classements incoherente avec le reste du site

La page Classements a une structure d'en-tete differente, sans favoris/recherche/boutique, avec des cartes qui tronquent certains titres et noms.

Attendu :
- Unifier l'en-tete.
- Conserver la lisibilite data.
- Corriger les truncations ou ajouter tooltips.

16. Images placeholders trop repetitives

Les artistes, shorts et produits utilisent souvent les memes images placeholder. Cela affaiblit la credibilite d'une plateforme musicale.

Attendu :
- Images artistes distinctes.
- Fallback unique mais moins repetitif.
- Ratio et poids optimises.

17. SEO incomplet

Points positifs :
- `lang="fr"`.
- Meta description presente.
- Open Graph et Twitter card presents.
- Un seul H1 sur l'accueil.
- Textes alt presents.

A corriger :
- Pas de canonical.
- Pas de JSON-LD.
- Titre HTML identique sur plusieurs pages.
- Pas de metadonnees specifiques par page.

18. Performance a mesurer

L'outil utilise n'a pas permis d'obtenir un score Lighthouse fiable. Visuellement, le site utilise des animations de chargement, gros backgrounds, overlays et images haute resolution.

Attendu :
- LCP < 2,5 s.
- CLS < 0,1.
- INP < 200 ms.
- Images optimises et dimensions reservees.
- Animation d'entree reduite ou desactivable via `prefers-reduced-motion`.

## 4. Diagnostic design et UX

### Points forts

- Identite forte, tres reconnaissable.
- Direction artistique coherente avec musique, nuit, club, galaxie.
- Hero impactant en bureau.
- Bonne hierarchie emotionnelle : HMI comme univers culturel, pas seulement annuaire.
- Favoris et extraits audio donnent une promesse produit interessante.
- La page Methodologie des classements renforce la confiance.

### Points faibles

- Trop d'elements crient en meme temps : majuscules, neon, gros visuels, fonds tres charges.
- Certaines zones sont difficiles a lire sur fond image.
- Les placeholders repétés cassent l'immersion.
- Les CTA ne menent pas toujours a une vraie action.
- Les menus et overlays sont trop dupliques.
- Mobile prioritaire a corriger avant toute autre evolution visuelle.
- Le libelle "Connexion" promet une fonction inexistante.

### Recommandation design

Conserver l'univers actuel, mais le rendre plus produit et moins pure demo :

- Garder le theme sombre, orange/rouge/bleu, et la typographie titre expressive.
- Reduire les doublons visuels dans l'en-tete.
- Ajouter des surfaces plus calmes pour les pages data.
- Remplacer les images placeholder par assets artistes/produits.
- Rendre les etats interactifs explicites : actif, vide, chargement, erreur, succes.

## 5. Cahier des charges pour Kiro

### Objectif general

Stabiliser Planete HMI pour en faire un MVP fiable de plateforme musicale haitienne : navigation mobile correcte, CTA fonctionnels, recherche pertinente, favoris propres, pages sans liens morts, donnees datees coherentes, design unifie et SEO de base.

### Perimetre MVP

Inclus :
- Accueil.
- Artistes.
- Classements et sous-pages.
- Actualites.
- Evenements.
- Boutique demo ou vitrine.
- Recherche globale.
- Favoris.
- Mini-player audio.
- Pages legales et contact.
- Authentification ou alternative claire si non implementee.

Exclus si non pret :
- Paiement reel.
- Billetterie reelle.
- Import API officiel complet.

### Priorite 1 : navigation et mobile

Exigences :
- Le menu mobile est ferme au chargement.
- Le hamburger ouvre/ferme le menu.
- Le menu occupe l'ecran avec un fond lisible et un bouton fermer.
- Les liens ferment le menu apres clic.
- Aucun element du menu ferme ne doit etre focusable ou cliquable.
- Pas de scroll horizontal non voulu.
- Le hero mobile doit afficher logo, hamburger, H1 lisible, texte court et CTA sans etre masque.

Critere d'acceptation :
- A 390 x 844, le premier ecran montre le hero et non un menu ouvert.
- Le clic hamburger ouvre puis ferme le menu.
- Le test clavier atteint les liens dans un ordre logique.

### Priorite 2 : correction Connexion et CTA

Exigences :
- Remplacer tous les `index.html#connexion`.
- Choisir une strategie :
  - route `/connexion` si login reel,
  - route `/inscription`,
  - ou CTA "Rejoindre" vers `/#connexion`.
- Creer un vrai formulaire pour "Creer un compte".
- Creer un vrai formulaire pour "Revendiquer mon profil".

Critere d'acceptation :
- Aucun clic Connexion ne mene a une 404.
- Chaque CTA principal a une destination ou une action claire.

### Priorite 3 : favoris

Exigences :
- Supprimer le doublon de bouton favoris.
- Garder un seul bouton avec compteur.
- Sauvegarder les favoris localement.
- Permettre ajout/retrait depuis cartes et panneau.
- Etat vide clair.
- Panneau accessible : fermeture par bouton, `Escape`, clic hors panneau.

Critere d'acceptation :
- Ajouter Roody Roodboy affiche compteur 1.
- Ouvrir favoris affiche Roody Roodboy.
- Retirer l'artiste remet compteur 0 et affiche l'etat vide.
- Fonctionne en bureau et mobile.

### Priorite 4 : recherche globale

Exigences :
- Prioriser les donnees internes HMI.
- Afficher resultats groupes : Artistes, Titres, Articles, Evenements.
- Deezer en complement seulement.
- Etats : vide, chargement, erreur, aucun resultat.
- Un seul overlay de recherche dans le DOM.
- Fermeture avec bouton et `Escape`.

Critere d'acceptation :
- Recherche "Roody" affiche Roody Roodboy en premier.
- Recherche "konpa" retourne artistes/titres/articles pertinents.
- Une erreur API n'affiche pas une liste incoherente.

### Priorite 5 : artistes, filtres et tri

Exigences :
- Le tri Popularite, Nom A-Z, Nouveautes doit modifier l'ordre.
- La recherche locale doit filtrer par nom, genre, tags.
- Les chips genres doivent etre de vrais boutons si elles filtrent.
- Pagination fonctionnelle ou retiree.

Critere d'acceptation :
- "Nom A-Z" commence par les artistes alphabetiquement.
- "Roody" ne montre que Roody Roodboy.
- Les boutons pages 2, 3, suivant ne pointent plus vers `#`.

### Priorite 6 : classements

Exigences :
- Corriger toutes les dates futures.
- Ajouter une validation : pas de publication future sans statut planifie.
- Harmoniser l'en-tete avec le reste du site ou documenter une variante volontaire.
- Eviter les noms tronques sans moyen de lire le texte complet.
- Garder la page Methodologie accessible.

Critere d'acceptation :
- Au 7 juillet 2026, aucune date affichee ne depasse le 7 juillet 2026 sauf mention "programme".
- Les sous-pages classement restent accessibles.

### Priorite 7 : evenements

Exigences :
- Les boutons "BILLETS" doivent pointer vers une page evenement ou un lien externe.
- "RAPPEL" doit ouvrir un mini-formulaire email ou creer un etat local.
- Les evenements de demo doivent etre marques comme demo si non reels.

Critere d'acceptation :
- Aucun bouton evenement ne pointe vers `#`.
- L'utilisateur comprend si l'evenement est reel, demo ou a venir.

### Priorite 8 : boutique

Option A - Boutique vitrine :
- Remplacer "AJOUTER AU PANIER" par "Voir le produit" ou "Bientot disponible".
- Supprimer toute promesse de panier.

Option B - Panier demo :
- Ajouter compteur panier.
- Ajouter panneau panier.
- Ajouter retrait article.
- Afficher total.
- Garder mention "aucun paiement reel".
- Supprimer le toast duplique.

Critere d'acceptation :
- Un clic panier donne un feedback unique.
- L'utilisateur peut voir ce qui est dans son panier ou comprend que la boutique est une vitrine.

### Priorite 9 : liens et pages de base

Creer ou corriger :
- `/methodologie` ou garder `/charts/methodology` et relier le footer.
- `/a-propos`.
- `/contact`.
- `/confidentialite`.
- `/conditions`.
- `/droits-auteur`.
- Liens sociaux reels ou masques.

Critere d'acceptation :
- Aucun lien visible ne pointe vers `#` sauf ancre volontaire avec cible.

### Priorite 10 : SEO et contenu

Exigences :
- Titre unique par page.
- Meta description unique par page.
- Canonical par page.
- JSON-LD `Organization`, `WebSite`, `MusicGroup` ou `MusicRecording` selon pages.
- Open Graph propre par page.
- Sitemap et robots.
- Dates coherentes et format francophone.

Critere d'acceptation :
- Chaque page principale a un title specifique.
- Les previews sociales affichent image, titre, description.
- Sitemap reference toutes les routes publiques.

### Priorite 11 : performance et accessibilite

Exigences :
- Optimiser images et placeholders.
- Precharger uniquement l'image hero critique.
- Respecter `prefers-reduced-motion`.
- Focus visible sur tous les controles.
- Contrastes texte/fond a verifier WCAG AA.
- Labels accessibles pour recherche, select, boutons lecture, favoris, panier.

Critere d'acceptation :
- Lighthouse cible : Performance > 80, Accessibilite > 90, SEO > 90.
- Navigation clavier complete sur accueil, artistes, boutique.
- Aucune animation indispensable ne bloque le contenu.

## 6. Prompt pret pour Kiro

Tu peux donner ceci a Kiro :

```text
Tu travailles sur Planete HMI, une plateforme musicale haitienne. Objectif : stabiliser le prototype en MVP fiable sans changer l'identite visuelle principale.

Priorites absolues :
1. Corriger le menu mobile : ferme par defaut, ouverture/fermeture fiable, liens qui ferment le menu, aucun blocage du hero.
2. Corriger tous les liens Connexion : supprimer `index.html#connexion`, eviter toute 404, creer une vraie route ou renommer le CTA.
3. Supprimer le doublon de bouton favoris. Garder un seul bouton avec compteur.
4. Stabiliser favoris : ajouter, retirer, ouvrir panneau, etat vide, fonctionnement mobile/bureau.
5. Corriger la recherche globale : un seul overlay, fermeture propre, resultats HMI internes prioritaires, Deezer en complement.
6. Corriger le tri Artistes : Popularite, Nom A-Z, Nouveautes doivent vraiment modifier l'ordre.
7. Transformer les chips de filtres en vrais boutons ou les rendre clairement decoratifs.
8. Corriger les dates futures des classements. Aucune date ne doit depasser le 7 juillet 2026 sauf contenu explicitement planifie.
9. Remplacer tous les liens `#` visibles par de vraies routes/actions, ou masquer les liens non disponibles.
10. Choisir pour la boutique : vitrine sans panier ou panier demo complet. Si panier demo, ajouter compteur, panneau, retrait et toast unique.
11. Harmoniser la page Classements avec le reste du site tout en gardant une lecture claire des donnees.
12. Ajouter SEO de base : title et description uniques, canonical, JSON-LD, sitemap, robots.
13. Optimiser images, placeholders, motion et accessibilite.

Critere de livraison :
- Aucun lien visible ne mene a une 404 ou `#` sans action.
- Mobile 390 x 844 utilisable.
- Recherche "Roody" affiche Roody Roodboy en premier.
- Favoris fonctionne sur bureau et mobile.
- Connexion ne mene jamais a `index.html#connexion`.
- Aucune date future non justifiee.
- Lighthouse cible : Performance > 80, Accessibilite > 90, SEO > 90.
```

