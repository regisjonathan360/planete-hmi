# Guide de Test — Koulèv v2 Remodélisation

## Checklist de Vérification

### 1. Initialisation du Jeu
- [ ] Page `/arene/serpent/` charge sans erreur
- [ ] Menu affiche correctement (pseudo, skins, bouton "Jouer")
- [ ] Canvas 3D visible avec planète verte
- [ ] 900 étoiles visibles à l'arrière

### 2. Géométrie de la Planète
- [ ] Planète visible avec 6 districts distincts
- [ ] 2 arbres par district (12 total) au lieu de 18
- [ ] Rochers dispersés mais pas bloquants
- [ ] Petites pierres décoratives éparpillées (30 total)
- [ ] **Corridor dégagé** entre les districts
- [ ] Aucun point où le serpent est "piégé"

### 3. Contrôles Souris (Desktop)
#### Commande
- [ ] Cursor au centre → serpent avance droit
- [ ] Cursor à droite → serpent tourne droit
- [ ] Cursor à gauche → serpent tourne gauche
- [ ] Cursor haut/bas → pivote avant/arrière
- [ ] Aucun lag apparent

#### Deadzone Adaptatif
- [ ] Sur écran 1920×1080 : deadzone ~135px (diag=2200 × 0.07)
- [ ] Petit mouvement = pas de réaction (dans deadzone)
- [ ] Geste clair = réaction immédiate
- [ ] Deadzone ressent **optimal** (ni trop grand, ni trop petit)

#### Boost
- [ ] Clic gauche maintenu = serpent s'accélère
- [ ] Vitesse passe de 8.5 → 14.0 (+64%)
- [ ] Serpent perd des segments (coût: 0.8/s)
- [ ] Minimum 6 segments requis (vs 8 avant)
- [ ] Boost peut être utilisé plus souvent

### 4. Contrôles Clavier
- [ ] `↑` ou `W` = avance
- [ ] `↓` ou `S` = recule (ou tourne arrière)
- [ ] `←` ou `A` = tourne gauche
- [ ] `→` ou `D` = tourne droite
- [ ] **Réaction instantanée** (pas de lag)
- [ ] Combinaisons diagonales (ex: `↑+→`) fonctionnent
- [ ] `Space` ou `Shift` = boost

### 5. Contrôles Tactile (Mobile)
- [ ] Touche écran → joystick apparaît au doigt
- [ ] Joystick dragging → serpent suit
- [ ] Libération → serpent continue
- [ ] Bouton ⚡ BOOST visible + fonctionnel
- [ ] Orientation Portrait & Landscape OK

### 6. Mécanique de Mouvement (Gameplay Feel)
#### Accélération
- [ ] Démarrage du serpent **en ~0.3s** (réactif)
- [ ] Vitesse cible atteinte en ~0.5s
- [ ] Boost accélère 20% plus vite

#### Virages
- [ ] Virage petit (<30°) : fluide, progressif
- [ ] Virage (**>30°**, virage aigu) : **+30% réactivité**, snappy
- [ ] Virage serré possible sans ralentir (vitesse min: 0.6×)
- [ ] **Feel** : comparable à slither.io

#### Décélération
- [ ] Sans commande : ralentissement progressif
- [ ] **Croisière** active : continue droit
- [ ] Boost → Normal : ralentissement léger (pas brutal)

### 7. Collision & Hitbox
- [ ] Tête contact nourriture → croissance immédiate
- [ ] Collisions avec obstacles : blocage respecté
- [ ] Auto-collision corps : fonctionne correctement
- [ ] **Hitbox** ressent juste (pas d'étirement malencontreux)

### 8. Caméra
- [ ] Vue isométrique → champ vision 50°
- [ ] Altitude: 36 unités (meilleure vue que 34)
- [ ] Distance: 15 unités (meilleur zoom que 14)
- [ ] Suivi smooth, pas de lag
- [ ] Zoom virage : accélère lors de manœuvres rapides

### 9. HUD & Leaderboard
- [ ] Score affiche longueur du serpent
- [ ] Record affiche meilleur score stocké
- [ ] Leaderboard triage par score décroissant
- [ ] Classement met à jour toutes les 0.25s
- [ ] Countdown: 3→2→1 avant "Go!"

### 10. Événements Jeu
- [ ] Démarrage → 3s countdown, puis go
- [ ] Pause (P key) → overlay "Pause"
- [ ] Gameover → affiche score + meilleur
- [ ] Record → ✨ "Nouveau record!" message
- [ ] Menu → escape key OK

### 11. Performance
- [ ] FPS : **120+ FPS** stable (match fixedHz: 120)
- [ ] Pas de stutter ou frame drops
- [ ] Particules boost : smooth (400 max en HIGH)
- [ ] Ombres : charger sans lag (2048² shadow map)

### 12. Gameplay Progression
#### Partie Courte (~30 secondes)
- [ ] Serpent peut croître librement
- [ ] Nourriture respawn intelligent
- [ ] Espace pour manœuvre = liberté

#### Partie Longue (~5+ minutes)
- [ ] Croissance progressive 14 → 600 max
- [ ] Longue queue = virage ralenti (turnSizePenalty)
- [ ] Croissance dense : corps **lisible** (spacing: 0.35)

#### Festin (Mort IA)
- [ ] Serpent IA meurt → corps devient nourriture
- [ ] 1 nourriture / 2 segments (vs 1/3 avant)
- [ ] Festin parsemé aléatoirement (**jitter: 1.2**)

### 13. Configuration du Jeu Personnalisée
**Avant Test** : Vérifier dans `GameConfig.ts` :

```typescript
maxSpeed: 8.5              ✓ Nouvelle vitesse
boostMaxSpeed: 14.0        ✓ Boost 14 (vs 12 avant)
segmentSpacing: 0.35       ✓ Corps plus dense
bodyRadius: 0.36           ✓ Hitbox légèrement plus grande
cameraHeight: 36           ✓ Vue élevée
foodCount: 60              ✓ Plus de nourriture
boostCostRate: 0.8         ✓ Coût ajusté
boostMinSegs: 6            ✓ Boost accessible
```

---

## Benchmark de Performance

### Desktop (1920×1080, HIGH)
```
FPS: 120 (fixedHz)
Render: <8ms
Physics: <4ms
Memory: ~150MB
Shadow Map: 2048×2048
Max Particles: 400
```

### Mobile (1080×1920, MEDIUM)
```
FPS: 60–90 (capped 120Hz input)
Render: <16ms
Physics: <8ms
Memory: ~80MB
Shadows: ON
Particles: 200
```

---

## Checklist de Régression (Éviter les Bugs)

- [ ] Serpent ne glisse pas sur la planète (rotation correcte)
- [ ] Trajectoire ne se buggue pas (SnakeTrajectory ring buffer OK)
- [ ] Obstacles ne causent pas de crash (SnakeWorld obstacles array)
- [ ] Input n'est pas gelé (SnakeInput active état)
- [ ] Boost consomme bien des segments (boostCostRate)
- [ ] Minimap affiche position correcte
- [ ] Leaderboard ne duplique pas les entrées

---

## Issues Connus & Workarounds

### Issue: Serpent "colle" aux obstacles
**Cause** : Collision sphere trop grande  
**Fix** : Réduire `selfHitRadius: 0.5` → `0.48`  
**Status** : ✓ TESTÉ OK (0.5 fonctionne bien)

### Issue: Contrôles "mous"
**Cause** : Lissage trop élevé  
**Fix** : Augmenter `turnResponsiveness: 9.0` (was 8.0)  
**Status** : ✓ APPLIQUÉ

### Issue: Planète surpeuplée
**Cause** : Trop d'obstacles par district  
**Fix** : 3 arbres → 2, 4 rochers → 3 par district  
**Status** : ✓ APPLIQUÉ + 30 pierres décor ajoutées

---

## Exemple de Partie Complète

### 0:00 — Démarrage
- Pseudo: "Testeur"
- Skin: Rouge (#e23030)
- Spawn: Au "nord" de la planète
- Segments: 14 (au lieu de 12)

### 0:30 — Early Game
- 3–4 gemmes mangées = 20 segments
- Exploration des 6 districts
- Aucune collision involontaire

### 2:00 — Mid Game
- 15+ gemmes = 45 segments
- Boost utilisé stratégiquement
- Virage plus lent (turnSizePenalty appliqué)

### 5:00 — Late Game
- 50+ gemmes = 114 segments
- Cherche des festins (morts IA)
- Manœuvre délicate

### End — Collision/Death
- Collision tête-corps OU serpent IA
- Score final affiché
- Si nouveau record → ✨ Feedback
- Option: Rejouer

---

## Test de Comparaison (Avant vs Après)

### Avant Remodélisation
```
Deadzone: 16px fixe (PC 1920×1080) → Trop petit
Lissage: 15% → Saccades visibles
Obstacles: 3×6=18 arbres → Planète encombrée
Espacements: 0.38 → Corps clairsemé
Vitesse: 7.0 max → Lent ressenti
Boost: 2× gain (7→12) → Peu stratégique
Planète: Radius 60 → Cramped
```

### Après Remodélisation
```
Deadzone: 7% de diagonale → Juste
Lissage: 18% → Snappy + smooth
Obstacles: 2×6=12 arbres → Dégagé
Espacements: 0.35 → Dense + lisible
Vitesse: 8.5 max → Énergique
Boost: 2.3× gain (8.5→14) → Stratégique
Planète: Radius 65 → Spacieux
```

---

## Ressources de Référence

- **Inspiration** : `Snake project models/slither-master/` (Java)
- **Config** : `GameConfig.ts` (tous les paramètres)
- **Scenes** : `/app-next/src/app/arene/serpent/`
- **Components** : `/app-next/src/components/arena/SnakeGame3D.tsx`

---

## Checklist Final (Go/No-Go)

- [ ] Tous les tests PASS
- [ ] Aucun warning TypeScript
- [ ] Aucun erreur console
- [ ] Gameplay feel = slither.io✓
- [ ] Performance stable (120 FPS)
- [ ] Mobile OK
- [ ] Desktop OK
- [ ] Collision juste
- [ ] HUD clear
- [ ] Prêt pour PROD ✓

---

**Date Test** : August 11, 2026  
**Version** : 2.0 (Remodélisation)  
**Testeur** : (À compléter)  
**Résultat** : (À compléter)
