# 🎵 Preview Audio dans les Battles - Documentation

## 🎯 Fonctionnalités ajoutées

### 1. Affichage des covers de musique
- ✅ Les covers s'affichent dans des cercles élégants
- ✅ Placeholder avec icône 🎵 si pas d'image
- ✅ Bordure qui brille au survol
- ✅ Animation de sélection quand on vote

### 2. Preview audio au survol
- ✅ **Survol = Preview automatique** de 10 secondes
- ✅ **Indicateur visuel** (icône 🎧 → vagues sonores animées)
- ✅ **Arrêt automatique** quand on retire la souris
- ✅ **Volume à 50%** pour ne pas être trop fort
- ✅ **Utilise Howler.js** pour une lecture fiable

### 3. Amélioration visuelle
- ✅ Effet de hover sur les images
- ✅ Animation des vagues sonores pendant la lecture
- ✅ Badge audio visible uniquement au survol
- ✅ Glow orange quand l'audio joue

---

## 📋 Installation

### Étape 1 : Appliquer la migration SQL

Dans l'éditeur SQL de Supabase :

```sql
-- Fichier: supabase/migrations/20260813_add_audio_to_battles.sql
-- Copier-coller tout le contenu et exécuter
```

Cette migration :
- Ajoute `side_a_audio_url` et `side_b_audio_url` à la table `battles`
- Crée une fonction helper `get_track_audio_url()` pour récupérer automatiquement les URLs

### Étape 2 : Mettre à jour les battles existantes

```sql
-- Fichier: supabase/update-battles-with-audio.sql
-- Copier-coller et exécuter pour remplir les URLs audio
```

### Étape 3 : Le code TypeScript est déjà mis à jour ✅

Les fichiers suivants ont été modifiés :
- `src/components/arene/BattleCard.tsx` - Ajout du preview audio
- `src/components/arene/BattleCard.module.css` - Styles pour l'audio

---

## 🎨 Design

### Avant survol
```
┌─────────────┐
│   ┌─────┐   │
│   │ 🎵  │   │  <- Cover de la musique
│   └─────┘   │
│   Titre     │
│  [Voter]    │
└─────────────┘
```

### Pendant le survol (avec audio)
```
┌─────────────┐
│   ┌─────┐   │
│   │ 🎵 🔊│  │  <- Cover + badge audio
│   └─────┘   │     (vagues animées)
│   Titre     │
│  [Voter]    │
└─────────────┘
     ↓
  🎵 Audio joue pendant 10 sec
```

---

## 🔧 Comment ça marche

### 1. Détection du survol
```typescript
<div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
```

### 2. Création du lecteur audio (Howler.js)
```typescript
const howl = new Howl({
  src: [audioUrl],
  html5: true,
  volume: 0.5,  // 50% du volume
  // ...
});
howl.play();
```

### 3. Arrêt automatique après 10 secondes
```typescript
setTimeout(() => {
  howl.stop();
}, 10000);  // 10 secondes
```

### 4. Nettoyage quand on quitte
```typescript
handleMouseLeave() {
  howl.stop();  // Arrêt immédiat
}
```

---

## 📊 Sources des URLs audio

La fonction `get_track_audio_url()` récupère l'audio dans cet ordre :

### 1. Platform Tracks (priorité)
```sql
SELECT preview_url FROM platform_tracks WHERE track_id = ?
```
Sources : Spotify, Audiomack, etc.

### 2. YouTube (fallback)
```sql
SELECT 'https://www.youtube.com/watch?v=' || video_id
FROM youtube_videos
WHERE track_id = ?
ORDER BY view_count DESC
```

### 3. Manuel (futur)
Possibilité d'ajouter manuellement des URLs audio dans l'admin.

---

## 🎯 Cas d'usage

### Battle entre 2 chansons
```
Chanson A          VS          Chanson B
[Cover A]  🎧              🎧  [Cover B]
Artiste A                      Artiste B
[Voter]                        [Voter]

Survol Cover A → Preview de la Chanson A
Survol Cover B → Preview de la Chanson B
```

### Battle entre 2 artistes
```
Artiste A          VS          Artiste B
[Photo A]                      [Photo B]
[Voter]                        [Voter]

Pas de preview audio (battles d'artistes)
```

---

## 🐛 Dépannage

### Les covers ne s'affichent pas

**Problème** : `side_a_image_url` ou `side_b_image_url` sont NULL

**Solution** :
```sql
-- Vérifier les URLs d'images
SELECT id, title, side_a_label, side_a_image_url, side_b_label, side_b_image_url
FROM battles
WHERE side_a_image_url IS NULL OR side_b_image_url IS NULL;

-- Les remplir manuellement ou depuis les tracks
UPDATE battles
SET side_a_image_url = (
  SELECT artwork_url FROM tracks WHERE id = battles.side_a_id LIMIT 1
)
WHERE side_a_type = 'song' AND side_a_image_url IS NULL;
```

### Le preview audio ne fonctionne pas

**Problème 1** : Pas d'URL audio dans la battle

```sql
SELECT id, title, side_a_audio_url, side_b_audio_url
FROM battles
WHERE side_a_audio_url IS NULL OR side_b_audio_url IS NULL;
```

**Solution** : Exécuter `update-battles-with-audio.sql`

**Problème 2** : URL audio invalide ou CORS

- Testez l'URL dans votre navigateur
- Vérifiez que le serveur autorise les CORS
- Pour YouTube, vous aurez besoin d'une extraction serveur

**Problème 3** : Howler.js n'est pas chargé

- Vérifiez que `howler` est dans `package.json`
- Vérifiez les erreurs console navigateur

### L'audio ne s'arrête pas

**Problème** : Le composant se démonte avant le `mouseLeave`

**Solution** : Le `useEffect` nettoie automatiquement :
```typescript
useEffect(() => {
  return () => {
    if (howlRef.current) {
      howlRef.current.unload();
    }
  };
}, []);
```

---

## ⚙️ Configuration

### Durée du preview
Par défaut : **10 secondes**

Pour changer :
```typescript
// Dans BattleCard.tsx, ligne ~85
setTimeout(() => {
  howl.stop();
}, 15000);  // 15 secondes au lieu de 10
```

### Volume du preview
Par défaut : **50%** (0.5)

Pour changer :
```typescript
// Dans BattleCard.tsx, ligne ~78
const howl = new Howl({
  volume: 0.7,  // 70% au lieu de 50%
});
```

### Désactiver l'auto-stop
Pour laisser l'audio jouer jusqu'à la fin :
```typescript
// Supprimer ou commenter le setTimeout
// setTimeout(() => { howl.stop(); }, 10000);
```

---

## 🎨 Personnalisation des styles

### Couleur de l'indicateur audio
```css
/* Dans BattleCard.module.css */
.audioIndicatorPlaying {
  background: rgba(255, 106, 0, 0.8);  /* Orange */
  /* Changez en : */
  background: rgba(138, 43, 226, 0.8);  /* Violet */
}
```

### Taille des covers
```css
.sideImageWrap {
  width: 80px;   /* Défaut */
  height: 80px;
  /* Changez en : */
  width: 120px;  /* Plus grand */
  height: 120px;
}
```

### Animation des vagues
```css
@keyframes audioWave {
  0%, 100% {
    height: 6px;    /* Hauteur min */
  }
  50% {
    height: 14px;   /* Hauteur max */
  }
}
```

---

## 📈 Améliorations futures

### Court terme
- [ ] Indicateur de chargement pendant le buffering
- [ ] Barre de progression du preview
- [ ] Bouton pour rejouer la preview
- [ ] Volume réglable par l'utilisateur

### Moyen terme
- [ ] Waveform visualization
- [ ] Comparaison côte à côte (split audio)
- [ ] Partage du preview sur les réseaux sociaux
- [ ] Statistiques des previews les plus écoutés

### Long terme
- [ ] Mode "battle DJ" avec crossfade
- [ ] Vote basé sur le timestamp préféré
- [ ] Clips courts TikTok/Instagram
- [ ] IA pour choisir le meilleur extrait

---

## 🎯 Checklist d'installation

- [ ] Migration SQL appliquée (`20260813_add_audio_to_battles.sql`)
- [ ] Battles existantes mises à jour (`update-battles-with-audio.sql`)
- [ ] Code TypeScript déployé (déjà fait ✅)
- [ ] Styles CSS déployés (déjà fait ✅)
- [ ] Test : survol d'une battle avec audio fonctionne
- [ ] Test : battles sans audio affichent le placeholder
- [ ] Test : l'audio s'arrête quand on retire la souris
- [ ] Test : l'audio ne joue pas en même temps sur les 2 côtés

---

## 📞 Support

**Problèmes ?**
1. Vérifiez la console navigateur (F12)
2. Testez les URLs audio directement
3. Vérifiez que les colonnes SQL existent
4. Consultez les logs Supabase

**Fonctionnalité demandée ?**
- Ajoutez une issue sur GitHub
- Ou implémentez et créez une PR !

---

**🎉 Profitez des battles avec preview audio !**
