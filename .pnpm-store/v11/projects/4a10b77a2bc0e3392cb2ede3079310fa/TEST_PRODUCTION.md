# 🧪 Plan de tests - Production

**À exécuter après déploiement Vercel**

---

## Test 1 : Vérifier le champ Sexe en admin (2 min)

### Étapes
1. Aller sur https://planete-hmi.vercel.app/admin/artistes
2. Cliquer sur un artiste existant
3. Descendre à la section "Sexe / Genre"

### Résultat attendu
- ✅ Section visible avec titre "Sexe / type de profil"
- ✅ 5 boutons visibles : ♂ Masculin, ♀ Féminin, 👥 Groupe, ⚧ Autre, Non précisé
- ✅ Un bouton peut être sélectionné
- ✅ La sauvegarde fonctionne

---

## Test 2 : Tester enrichissement Wikipedia (5 min)

### Artistes de test recommandés
- Wyclef Jean : `https://fr.wikipedia.org/wiki/Wyclef_Jean`
- Michel Martelly : `https://fr.wikipedia.org/wiki/Michel_Martelly`
- Emeline Michel : `https://fr.wikipedia.org/wiki/Emeline_Michel`

### Étapes
1. Éditer un artiste (ex: Wyclef Jean)
2. Dans section "Autres plateformes", coller l'URL Wikipedia
3. Descendre à "Enrichissement automatique"
4. Cliquer sur "Enrichir depuis Wikipedia"

### Résultat attendu
- ✅ Loader/spinner pendant 2-5 secondes
- ✅ Message de succès affiché
- ✅ Bio pré-remplie (vérifier dans le champ "Biographie")
- ✅ Date de naissance extraite (champ "Date de naissance")
- ✅ Lieu de naissance extrait (champ "Commune de naissance")
- ✅ Genres ajoutés (section Tags)
- ✅ Image téléchargée (vérifier le champ "Photo de profil")

### Si ça échoue
- Vérifier la console navigateur (F12)
- Vérifier les logs Vercel
- Essayer avec une autre URL Wikipedia
- Vérifier que l'article Wikipedia a un infobox

---

## Test 3 : Vérifier champs Chartmetric et Shazam (1 min)

### Étapes
1. Rester sur la page d'édition d'artiste
2. Chercher la section "Autres plateformes"

### Résultat attendu
- ✅ Champ "Chartmetric" visible
- ✅ Champ "Shazam" visible
- ✅ Les URLs peuvent être saisies
- ✅ La sauvegarde fonctionne

---

## Test 4 : Vérifier le tag Animateur (2 min)

### Étapes
1. Éditer un artiste ou en créer un nouveau
2. Aller à la section "Rôles / Étiquettes"
3. Chercher le tag "Animateur / Ambianceur"
4. Le sélectionner
5. Sauvegarder

### Résultat attendu
- ✅ Tag 🎉 "Animateur / Ambianceur" visible dans la liste
- ✅ Couleur jaune (#fbbf24)
- ✅ Peut être sélectionné/désélectionné
- ✅ Sauvegarde réussie

---

## Test 5 : Filtre par sexe sur page publique (3 min)

### Étapes préliminaires
1. S'assurer que 3-4 artistes ont un sexe défini (m, f, ou g)
2. Aller sur https://planete-hmi.vercel.app/artistes

### Étapes
1. Observer la page
2. Chercher les filtres (normalement en haut)
3. Identifier la 3e rangée de filtres (après Rôles et Genres)

### Résultat attendu
- ✅ 3e rangée de filtres visible avec titre "Filtrer par sexe"
- ✅ 4 boutons visibles : Tous, 👨 Masculin, 👩 Féminin, 👥 Groupes
- ✅ Par défaut, "Tous" est sélectionné
- ✅ Cliquer sur "👨 Masculin" filtre uniquement les artistes masculins
- ✅ Cliquer sur "👩 Féminin" filtre uniquement les artistes féminines
- ✅ Cliquer sur "👥 Groupes" filtre uniquement les groupes
- ✅ Le compteur d'artistes se met à jour
- ✅ Les artistes sans sexe spécifié restent visibles sur "Tous"

---

## Test 6 : Filtre Animateur sur page publique (2 min)

### Étapes préliminaires
1. S'assurer qu'au moins 1 artiste a le tag "Animateur"

### Étapes
1. Rester sur https://planete-hmi.vercel.app/artistes
2. Chercher le filtre par rôle (1re rangée)
3. Cliquer sur "🎉 Animateur / Ambianceur"

### Résultat attendu
- ✅ Seuls les artistes avec le tag "Animateur" sont affichés
- ✅ Icône 🎉 visible sur les cartes artistes
- ✅ Couleur jaune (#fbbf24) pour le tag

---

## Test 7 : Combinaison de filtres (2 min)

### Étapes
1. Sur https://planete-hmi.vercel.app/artistes
2. Sélectionner un rôle (ex: Chanteur)
3. Sélectionner un genre (ex: Konpa)
4. Sélectionner un sexe (ex: Féminin)

### Résultat attendu
- ✅ Seuls les artistes correspondant aux 3 critères sont affichés
- ✅ Les filtres fonctionnent en mode AND (intersection)
- ✅ Le compteur se met à jour correctement
- ✅ Aucune erreur JavaScript dans la console

---

## Test 8 : Régression - Enrichissement existant (3 min)

### Étapes
1. Éditer un artiste
2. Ajouter une URL Spotify valide
3. Cliquer sur "Enrichir depuis Spotify"

### Résultat attendu
- ✅ L'enrichissement Spotify fonctionne toujours
- ✅ Aucune régression causée par les nouveaux champs
- ✅ Données extraites correctement (followers, popularity, genres, image)

---

## Résumé des temps

| Test | Durée | Priorité |
|------|-------|----------|
| Test 1 : Sexe admin | 2 min | ⭐⭐⭐ Critique |
| Test 2 : Wikipedia | 5 min | ⭐⭐⭐ Critique |
| Test 3 : Chartmetric/Shazam | 1 min | ⭐⭐ Important |
| Test 4 : Tag Animateur | 2 min | ⭐⭐⭐ Critique |
| Test 5 : Filtre sexe public | 3 min | ⭐⭐⭐ Critique |
| Test 6 : Filtre Animateur | 2 min | ⭐⭐⭐ Critique |
| Test 7 : Filtres combinés | 2 min | ⭐⭐ Important |
| Test 8 : Régression | 3 min | ⭐⭐ Important |
| **TOTAL** | **20 min** | |

---

## Checklist rapide

Cochez au fur et à mesure :

- [ ] Test 1 : Champ Sexe visible et fonctionnel
- [ ] Test 2 : Enrichissement Wikipedia fonctionne
- [ ] Test 3 : Champs Chartmetric/Shazam visibles
- [ ] Test 4 : Tag Animateur visible et sauvegardable
- [ ] Test 5 : Filtre par sexe fonctionne
- [ ] Test 6 : Filtre Animateur fonctionne
- [ ] Test 7 : Filtres combinés fonctionnent
- [ ] Test 8 : Pas de régression sur Spotify

---

## En cas d'échec

### Test 1-4 échouent (admin)
→ Problème probable : ArtistEditForm.tsx pas déployé
→ Action : Vérifier build Vercel, redéployer si nécessaire

### Test 5-7 échouent (public)
→ Problème probable : ArtistesGrid.tsx ou page.tsx pas déployé
→ Action : Vérifier build Vercel, redéployer si nécessaire

### Test 2 échoue (Wikipedia)
→ Problème probable : API Wikipedia bloquée ou timeout
→ Action : Vérifier logs Vercel, augmenter timeout si nécessaire

### Test 8 échoue (régression)
→ Problème probable : Conflit dans EnrichmentPanel
→ Action : Rollback immédiat (voir DEPLOIEMENT.md)

---

**Document créé le** : 5 août 2026  
**Durée totale des tests** : 20 minutes  
**Tests critiques** : 6/8 (marqués ⭐⭐⭐)
