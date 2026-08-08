# 📸 Captures d'écran attendues en production

Ce document décrit visuellement ce que vous devriez voir après le déploiement.

---

## 🖥️ Page Admin - Édition artiste

### 1. Section "Sexe / Genre"

**Emplacement** : Après la section "Statut & visibilité"

```
┌─────────────────────────────────────────────────────┐
│ Sexe / type de profil                               │
├─────────────────────────────────────────────────────┤
│ Utilisé pour le filtre public. Choisissez          │
│ « Groupe » pour un orchestre ou collectif.         │
│                                                     │
│ [♂ Masculin] [♀ Féminin] [👥 Groupe]              │
│ [⚧ Autre] [Non précisé]                            │
│                                                     │
│ (Un seul bouton sélectionné à la fois)             │
└─────────────────────────────────────────────────────┘
```

**Style attendu** :
- Boutons avec border gris clair par défaut
- Bouton sélectionné : border orange + fond orange léger
- Hover : border orange

---

### 2. Section "Autres plateformes"

**Emplacement** : Après "Réseaux sociaux"

```
┌─────────────────────────────────────────────────────┐
│ Autres plateformes                                  │
├─────────────────────────────────────────────────────┤
│ Wikipedia                                           │
│ ┌─────────────────────────────────────────────────┐ │
│ │ https://fr.wikipedia.org/wiki/...               │ │
│ └─────────────────────────────────────────────────┘ │
│ ✨ Extraction automatique : bio, date/lieu         │
│    naissance, nom réel, genres, image              │
│                                                     │
│ Chartmetric                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ https://chartmetric.com/artist/...              │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Shazam                                             │
│ ┌─────────────────────────────────────────────────┐ │
│ │ https://www.shazam.com/artist/...               │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

### 3. Section "Rôles / Étiquettes"

**Nouveauté** : Tag "🎉 Animateur / Ambianceur" dans la liste

```
┌─────────────────────────────────────────────────────┐
│ Rôles / Étiquettes                                  │
├─────────────────────────────────────────────────────┤
│ Le type principal et les catégories publiques       │
│ sont synchronisés automatiquement avec ces rôles.   │
│                                                     │
│ [Chanteur] [DJ] [Producteur] [Rappeur]            │
│ [🎉 Animateur / Ambianceur] ← NOUVEAU             │
│ [Musicien] [Beatmaker] [Groupe]                   │
│                                                     │
│ (Le tag Animateur apparaît avec fond jaune quand   │
│  sélectionné)                                      │
└─────────────────────────────────────────────────────┘
```

---

### 4. Panneau "Enrichissement automatique"

**Nouveauté** : Wikipedia, Chartmetric, Shazam dans la liste

```
┌─────────────────────────────────────────────────────┐
│ Enrichissement automatique                          │
├─────────────────────────────────────────────────────┤
│ Plateformes renseignées :                          │
│                                                     │
│ [🟢 Spotify] [▶️ YouTube] [🎵 Deezer]            │
│ [📖 Wikipedia] ← NOUVEAU                           │
│ [📊 Chartmetric] ← NOUVEAU                        │
│ [🎵 Shazam] ← NOUVEAU                             │
│                                                     │
│ Cliquez sur une plateforme pour lancer            │
│ l'extraction automatique des données.              │
└─────────────────────────────────────────────────────┘
```

**Comportement au clic sur Wikipedia** :
1. Loader/spinner pendant 2-5 secondes
2. Message de succès : "✅ Données extraites depuis Wikipedia"
3. Champs pré-remplis automatiquement :
   - Bio dans "Biographie"
   - Date dans "Date de naissance"
   - Lieu dans "Commune de naissance"
   - Genres dans "Tags"
   - Image dans "Photo de profil"

---

## 🌐 Page Publique - /artistes

### 1. Barre de filtres (3 rangées)

```
┌─────────────────────────────────────────────────────┐
│ [🔍 Rechercher un artiste...]         [▼ Tri: Nom] │
├─────────────────────────────────────────────────────┤
│ 1. Filtrer par rôle :                               │
│ [Tous les rôles] [Chanteur] [DJ] [Rappeur]        │
│ [🎉 Animateur] ← NOUVEAU                           │
├─────────────────────────────────────────────────────┤
│ 2. Filtrer par genre :                              │
│ [🎵 Tous] [🪘 Konpa] [🔥 Raboday] [🎙️ Hip-Hop]   │
├─────────────────────────────────────────────────────┤
│ 3. Filtrer par sexe : ← NOUVEAU                     │
│ [Tous] [👨 Masculin] [👩 Féminin] [👥 Groupes]    │
└─────────────────────────────────────────────────────┘
```

**Style attendu** :
- Bouton actif : fond violet/bleu (accent primaire du site)
- Boutons inactifs : fond transparent, border gris
- Hover : border colorée

---

### 2. Carte artiste avec tag Animateur

```
┌───────────────────┐
│   [Photo 120x120] │
│                   │
│   Nom Artiste     │
│                   │
│ 🎉 Animateur      │ ← Tag jaune
│ Konpa             │
│                   │
│ [❤️ Favoris]      │
└───────────────────┘
```

**Couleur du tag Animateur** : Fond jaune clair (#fbbf24) avec icône 🎉

---

### 3. Comportement du filtre par sexe

**Scénario 1** : Cliquer sur "👨 Masculin"
- Seuls les artistes avec `gender = 'm'` sont affichés
- Le bouton "👨 Masculin" devient actif (fond coloré)
- Compteur mis à jour : "12 artistes trouvés" → "5 artistes trouvés"

**Scénario 2** : Cliquer sur "👩 Féminin"
- Seuls les artistes avec `gender = 'f'` sont affichés
- Le bouton "👩 Féminin" devient actif

**Scénario 3** : Cliquer sur "👥 Groupes"
- Seuls les artistes avec `gender = 'g'` sont affichés
- Le bouton "👥 Groupes" devient actif

**Scénario 4** : Recliquer sur "Tous"
- Tous les artistes redeviennent visibles (y compris ceux sans sexe spécifié)
- Le bouton "Tous" devient actif

---

## 🎨 Palette de couleurs

### Tag Animateur
- **Couleur principale** : #fbbf24 (jaune)
- **Fond** : rgba(251, 191, 36, 0.12)
- **Icône** : 🎉

### Boutons sexe (admin)
- **Border défaut** : var(--line) (gris clair)
- **Border hover** : var(--flame-orange) (orange)
- **Border actif** : var(--flame-orange) (orange)
- **Fond actif** : rgba(255, 106, 0, 0.1)

### Filtres publics
- **Fond actif** : var(--admin-accent) (violet/bleu)
- **Border actif** : var(--admin-accent)
- **Couleur texte actif** : #fff (blanc)

---

## ✅ Checklist visuelle rapide

Après déploiement, vérifiez visuellement :

### Admin
- [ ] Section "Sexe / Genre" visible avec 5 boutons
- [ ] Section "Autres plateformes" avec 3 champs (Wikipedia, Chartmetric, Shazam)
- [ ] Tag 🎉 "Animateur / Ambianceur" dans la liste des rôles
- [ ] Panneau enrichissement avec Wikipedia/Chartmetric/Shazam

### Public
- [ ] 3 rangées de filtres (Rôles, Genres, Sexe)
- [ ] 4 boutons dans filtre Sexe (Tous, Masculin, Féminin, Groupes)
- [ ] Tag Animateur jaune sur les cartes artistes
- [ ] Filtre par sexe fonctionne (nombre d'artistes change)

---

## 📱 Vue responsive (mobile)

### Filtres sur mobile
```
┌────────────────┐
│ [🔍 Recherche] │
├────────────────┤
│ Rôles :        │
│ [Tous] [DJ]    │
│ [🎉 Animateur] │
├────────────────┤
│ Genres :       │
│ [Tous] [Konpa] │
│ [Hip-Hop]      │
├────────────────┤
│ Sexe :         │
│ [Tous]         │
│ [👨 M] [👩 F]  │
│ [👥 Groupes]   │
└────────────────┘
```

Les filtres doivent rester utilisables sur mobile avec les boutons qui s'empilent correctement.

---

**Document créé le** : 5 août 2026  
**Pour** : Validation visuelle post-déploiement
