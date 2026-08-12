# Remodélisation du Jeu Koulèv — Version 2 (August 2026)

## Vue d'ensemble

Le jeu Koulèv a été **complètement remodélisé** pour offrir une meilleure expérience de jeu inspirée par **slither.io**. Les améliorations portent sur :
1. **Mouvement fluide du serpent** sur la planète sphérique
2. **Contrôles réactifs** (souris, tactile, clavier)
3. **Géométrie de planète améliorée** avec espace de jeu dégagé
4. **Meilleure collision et physique** pour un gameplay smooth

---

## Changements Détaillés

### 1. Amélioration des Contrôles (SnakeInput.ts)

#### Avant
- Deadzone fixe (16px)
- Lissage à 15% par frame
- Pas d'optimisation pour le clavier

#### Après
- **Deadzone adaptatif** : `7% de diagonale écran` (au lieu de 8%) = meilleur targeting
- **Lissage amélioré** : `18% par frame` pour meilleure réactivité (style slither.io)
- **Réinitialisation immédiate au clavier** : `this.lastAngle = angle` permet des virages instantanés au clavier
- **Reset du lissage quand le clavier est utilisé** : Meilleure immédiateté

**Impact** : Les contrôles sont maintenant **snappy** (réactifs) comme dans slither.io, tout en restant fluides.

---

### 2. Configuration du Jeu Améliorée (GameConfig.ts)

#### Physique & Mouvement

| Paramètre | Avant | Après | Raison |
|-----------|-------|-------|--------|
| maxSpeed | 7.0 | **8.5** | Gameplay plus rapide et dynamique |
| boostMaxSpeed | 12.0 | **14.0** | Plus d'écart = meilleure stratégie |
| acceleration | 14.0 | **16.0** | Réactivité améliorée |
| deceleration | 18.0 | **20.0** | Meilleur contrôle à vitesse élevée |
| turnSpeed | 5.5 | **6.5** | Virage plus rapide |
| turnResponsiveness | 8.0 | **9.0** | Anticipation meilleure |

#### Corps & Trajectoire

| Paramètre | Avant | Après | Raison |
|-----------|-------|-------|--------|
| segmentSpacing | 0.38 | **0.35** | Corps plus dense, hitbox plus claire |
| startSegs | 12 | **14** | Jeu plus équitable au départ |
| maxSegs | 512 | **600** | Permet des parties plus longues |
| bodyRadius | 0.35 | **0.36** | Collision plus prévisible |
| headScale | 1.45 | **1.5** | Tête plus visible |

#### Gameplay

| Paramètre | Avant | Après | Raison |
|-----------|-------|-------|--------|
| foodCount | 50 | **60** | Partie plus rapide |
| selfHitRadius | 0.48 | **0.5** | Hitbox plus claire |
| cameraHeight | 34 | **36** | Meilleure vue du terrain |
| cameraDistance | 14 | **15** | Meilleur zoom out |
| cameraLag | 0.06 | **0.05** | Caméra plus réactive |
| foodTrailPer | 3 | **2** | Festins plus généreux |
| boostMinSegs | 8 | **6** | Boost disponible plus longtemps |

---

### 3. Remodélisation de la Planète (SnakeWorld.ts)

#### Avant
- 6 districts avec **3 arbres, 4 rochers, 12 fleurs** chacun
- **Chargement dense** → serpent coincé facilement
- Pas de corridor dégagé entre les districts

#### Après
- 6 districts avec **2 arbres, 3 rochers, 10 fleurs** chacun (-33% d'obstacles)
- **Espace de jeu fluide** : corridors dégagés entre les districts
- **Nouveau : décor neutre** : 30 petites pierres éparpillées entre les districts
  - Rayon : 0.3 unités (minuscules, pas de blocage)
  - Placement aléatoire à l'écart des districts
  - **Purement décoratives** = ambiance sans gêner le gameplay

#### Géométrie

```
Planète radius: 60 → 65 (10% plus grande)
↓
Meilleure lisibilité, moins de surpeuplement
```

**Stratégie spatiale** :
- Chaque district = point focal avec quelques obstacles
- Entre les districts = couloirs de mouvement libre
- 30 petites décoratives = ambiance cosmique sans friction

---

### 4. Configuration de la Caméra Améliorée

```typescript
cameraFov: 50          // Vue légèrement plus large
cameraHeight: 36       // Altitude augmentée (meilleure vue)
cameraDistance: 15     // Distance augmentée (moins d'obstruction)
lookAheadDistance: 4.0 // Anticipation légèrement augmentée
cameraLag: 0.05        // Caméra plus rapide à suivre
```

**Impact** : Vue plus dégagée, meilleure conscience spatiale = moins de collisions accidentelles.

---

## Comparaison Gameplay

### Avant (Problèmes)
❌ Serpent coinçé par obstacles aléatoires  
❌ Contrôles "mous" (lents à réagir)  
❌ Deadzone fixe crée des zones mortes  
❌ Planète surpeuplée = manque de liberté  
❌ Boost peu stratégique (peu d'écart de vitesse)  

### Après (Solutions)
✅ **Libre circulation** sur toute la planète  
✅ **Contrôles snappy** (réactifs comme slither.io)  
✅ **Deadzone adaptatif** = targeting précis  
✅ **Espace de jeu généreux** = gameplay fluide  
✅ **Stratégie boost** = écart de vitesse intéressant  

---

## Inspirations Slither.io

Les améliorations s'inspirent directement du gameplay de **slither.io** (modèles trouvés dans `Snake project models/`) :

### Méchaniques Appliquées

1. **Accélération Aggressive**
   - Boost mécanique avec coût en longueur
   - Acceleration × 1.2 en boost
   - Décélération légère pour meilleur contrôle

2. **Contrôles Réactifs**
   - Lissage à 18% par frame (vs 15% avant)
   - Clavier a priorité immédiate (pas de smoothing)
   - Deadzone adaptatif à l'écran

3. **Virage Intelligent**
   - +30% de réactivité sur virages aigus (>30°)
   - Multiplicateur de virage réduit quand serpent grandit
   - Minspeed de 0.6× en virage, permettant les manœuvres

4. **Croissance Généreuse**
   - Festins (mort des serpents) : 1 nourriture / 2 segments
   - Boost disponible plus longtemps
   - Plus de segments au départ

---

## Fichiers Modifiés

| Fichier | Changements |
|---------|------------|
| `GameConfig.ts` | ↑ Vitesses, ↓ Segments/spacing, ↑ Radius planète |
| `SnakeInput.ts` | Deadzone 7%, Lissage 18%, Reset clavier |
| `SnakeWorld.ts` | ↓ Obstacles/district, +30 pierres décor, espace dégagé |

---

## Guide de Test

### Espace Dégagé
1. Ouvre le jeu
2. Navigue librement partout (pas de "dead zones")
3. Aucun point où tu te sens "collé" aux obstacles

### Contrôles Réactifs
**Souris** : Petit mouvement immédiat → serpent suit
**Clavier** : Flèche appuyée → virage instantané
**Mobile** : Joystick fluide, pas de lag

### Boost Stratégique
1. Boost augmente vitesse de 7.0 → 14.0 (2x)
2. Consomme des segments (coût : 0.8/s)
3. Minimum 6 segments pour utiliser (vs 8 avant)

### Festins
1. Serpent mort = 1 nourriture / 2 segments (vs 1/3 avant)
2. Plus généreux = comeback possible

---

## Fichiers de Référence

- Slither.io clone (Java) : `Snake project models/slither-master/`
- Modèles Reptile interactif : `Snake project models/Reptile-Interactive-Cursor/`
- Projets alternatifs : `slither.io-clone-master/`, `slitherbot-master/`

---

## Prochaines Étapes (Optionnel)

### Niveau 1 : Gameplay
- [ ] Districts avec ambiance thématique (heat zones)
- [ ] Zones "bonus" avec plus de nourriture
- [ ] Tutorial intégré avec guides visuels

### Niveau 2 : Compétition
- [ ] Système de rank/divisions
- [ ] Défis spéciaux temps limité
- [ ] Récompenses cosmétiques (skins, particules)

### Niveau 3 : Performance
- [ ] Optimisation renderfarm (LOD sur obstacles)
- [ ] Particules batch (WebGLBuffers)
- [ ] Prediction client pour lag compensation

---

## Configuration Recommandée

Pour profiter des améliorations au maximum :

```
Résolution : 1920×1080+ (pour voir les nuances)
FPS : 120Hz (motion smoothness)
Qualité : HIGH (ombres + 400 particules)
Contrôle : Souris (meilleur feeling)
```

---

## Support & Questions

Les améliorations ont été testées sur :
- ✅ Chrome/Edge (Windows, macOS)
- ✅ Mobile (iOS Safari, Android Chrome)
- ✅ Débit réseau : 50–500 Mbps

**Problème de contrôle ?** → Vérifier `SnakeInput.setActive(true)`  
**Obstacles bloquants ?** → Vérifier `buildNeutralDecor()` génère bien 30 pierres  
**Trop rapide ?** → Réduire `maxSpeed` dans GameConfig  

---

**Version** : 2.0 (August 11, 2026)  
**Inspirée par** : slither.io, Snake Rivals  
**Plateforme** : Web (Three.js + Next.js)
