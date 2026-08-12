/* ------------------------------------------------------------
   GameConfig.ts — Configuration centralisée du Snake 3D
   Style Slither.io remodélisé : arène planétaire fluide, 
   mouvement smooth, collisions douces, gameplay compétitif.
   ------------------------------------------------------------ */

export interface QualityProfile {
  name: "LOW" | "MEDIUM" | "HIGH";
  maxPixelRatio: number;
  shadows: boolean;
  maxParticles: number;
  bloom: boolean;
  antialias: boolean;
}

export const SNAKE_CONFIG = {
  /* Physique & Mouvement de la tête (Slither.io inspired) */
  maxSpeed: 8.5,        // Vitesse normale (augmentée pour meilleur feeling)
  boostMaxSpeed: 14.0,  // Vitesse boost (plus d'écart pour stratégie)
  acceleration: 16.0,   // Accélération plus rapide (meilleure réactivité)
  deceleration: 20.0,   // Décélération plus forte (meilleur contrôle)
  turnSpeed: 6.5,       // Vitesse de virage base
  turnResponsiveness: 9.0, // Réactivité du virage (meilleure anticipation)
  inertia: 0.12,        // Inertie réduite (contrôle plus direct)

  /* Corps & Trajectoire */
  segmentSpacing: 0.35, // Espacement réduit (corps plus dense)
  startSegs: 14,        // Départ avec plus de segments (jeu plus juste)
  maxSegs: 600,         // Plus de segments possibles
  bodyRadius: 0.36,     // Radius légèrement augmenté (hitbox plus claire)
  headScale: 1.5,       // Tête plus visible
  tailTaper: 0.3,       // Queue s'effile plus doucement

  /* Caméra Isométrique (style Snake Rivals optimisé) */
  cameraFov: 50,
  cameraNormalFov: 50,
  cameraFastFov: 54,
  cameraMaxFov: 58,
  cameraHeight: 36,
  cameraDistance: 15,
  cameraAngle: 55,
  lookAheadDistance: 4.0,
  cameraLag: 0.05,      // Caméra plus réactive
  cameraTiltMax: 0.0,

  /* Planète sphérique remodélisée */
  planetRadius: 65,     // Planète plus grande (meilleure lisibilité)

  /* Gameplay & Collisions (style Slither.io) */
  foodCount: 60,        // Plus de nourriture (partie plus rapide)
  foodGrow: 2,
  selfHitRadius: 0.5,   // Hitbox légèrement augmentée (mais réactif)
  magnetRadius: 0.0,
  fixedHz: 120,

  /* Mort & nourriture (style slither.io amélioré) */
  foodTrailPer: 2,      // 1 nourriture tous les 2 segments (festin généreux)
  foodTrailJitter: 1.2, // Meilleure dispersion
  boostCostRate: 0.8,   // Coût du boost ajusté
  boostMinSegs: 6,      // Possibilité de boost plus longtemps
  turnSizePenalty: 0.004, // perte de maniabilité avec la taille (virage)

  /* IA */
  aiCount: 6,
  aiStartSegs: 10,
  aiRespawnDelay: 5.0,
  aiThreatRadius: 2.8, // rayon d'évitement des autres serpents
  aiThreatBoostRadius: 1.8, // rayon de fuite en boost
  aiSpawnGrace: 1.5, // invulnérabilité des IA au respawn
  aiNames: ["Cobra", "Viper", "Mamba", "Naga", "Boa", "Python"],

  /* Couleurs de serpent (joueur = index 0) */
  snakeColors: [
    0xe23030, // rouge (joueur)
    0x8844cc, // violet
    0x33aa44, // vert
    0x3388dd, // bleu
    0xee8811, // orange
    0xdd44aa, // rose
    0x44cccc, // turquoise
  ],

  /* Profils de qualité graphiques */
  profiles: {
    LOW: {
      name: "LOW",
      maxPixelRatio: 1.0,
      shadows: false,
      maxParticles: 80,
      bloom: false,
      antialias: false,
    },
    MEDIUM: {
      name: "MEDIUM",
      maxPixelRatio: 1.5,
      shadows: true,
      maxParticles: 200,
      bloom: false,
      antialias: true,
    },
    HIGH: {
      name: "HIGH",
      maxPixelRatio: 2.0,
      shadows: true,
      maxParticles: 400,
      bloom: false,
      antialias: true,
    },
  } as Record<string, QualityProfile>,
} as const;

export const CFG = SNAKE_CONFIG;
