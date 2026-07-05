# Structure

## Current layout

```
.
├── .kiro/steering/     # Project steering rules for the AI assistant
├── .vscode/            # Editor config (Chrome launch on :8080)
├── brand/              # Logos and icons (SVG + PNG)
└── image/              # All non-brand imagery, grouped by purpose
    ├── artists/        # Artist banner + square placeholders
    ├── backgrounds/    # Full-page cosmic backgrounds (desktop/mobile), hero, profile
    ├── covers/         # Content cover art (banner + square)
    ├── districts/      # District imagery (currently empty)
    ├── effects/        # Layered cosmic effects: nebula, stars, glow, planet foreground
    └── social/         # Social sharing / Open Graph images
```

## Directory purpose

- **`brand/`** — Logo system. Variants cover horizontal/vertical/icon layouts and dark/light/monochrome themes. Use SVG in-app; PNG as fallback.
- **`image/artists/`, `image/covers/`** — Placeholder content assets, each in `banner` and `square` aspect ratios.
- **`image/backgrounds/`** — Page-level backdrops with dedicated `-desktop` and `-mobile` variants; also `hero-head` and `profil-background`.
- **`image/effects/`** — Composable visual layers meant to be stacked (e.g. `stars-distant`, `stars-near`, `nebula-left/right`, `cosmic-glow`, `planet-foreground`).
- **`image/social/`** — Preview images for social/link sharing.

## Naming conventions

- Files are **kebab-case** and prefixed with `planet-hmi-` for brand and shared assets.
- Descriptive suffixes encode intent: aspect (`-banner`, `-square`), device (`-desktop`, `-mobile`), theme (`-dark`, `-light`, `-monochrome-white`), and layer (`-left`, `-right`, `-near`, `-distant`).
- Keep this convention for new assets. Effect layers stay unprefixed by feature but descriptive.

## When adding source code

- Place application code in its own top-level directory (e.g. `src/`); do not mix it into `brand/` or `image/`.
- Reference assets by their existing paths and prefer the `.webp` variants for delivery.
