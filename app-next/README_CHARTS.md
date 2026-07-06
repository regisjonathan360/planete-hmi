# Module Classements — Planète HMI

Classements musicaux hebdomadaires (YouTube, Spotify, Audiomack, Apple Music, TikTok) consacrés aux chansons d'artistes haïtiens vérifiés.

## Démarrage rapide (dev local)

```bash
# Prérequis : Node ≥ 18, Docker Desktop, Supabase CLI
cd app-next
npm install
supabase start       # lance la base locale (première fois = téléchargement images)
supabase db reset    # applique les migrations + seed
npm run dev          # http://localhost:3000
```

- **Classements publics** : http://localhost:3000/charts
- **Admin** : http://localhost:3000/admin/login
  - Email : `admin@hmi.test` / Mot de passe : `hmiadmin123` (compte dev local)
- **Studio Supabase** : http://127.0.0.1:54323

## Architecture

Voir `.kiro/specs/classements-hmi/design.md` pour le diagramme d'architecture complet.

```
app-next/
├── src/app/charts/         Pages publiques (/charts, /charts/[platform], /charts/methodology)
├── src/app/admin/charts/   Admin protégée (import, review, sources, history)
├── src/lib/charts/         Cœur logique (adaptateurs, normalisation, correspondance, classement, validation)
├── supabase/migrations/    Schéma PostgreSQL + RLS + fonctions SQL
├── supabase/functions/     Edge Functions (collecte, traitement, retry, stale)
└── tests/                  Unit + integration + E2E (Playwright)
```

## Principes non négociables

1. Ne jamais inventer d'API ; les adaptateurs en mode manuel renvoient `manual_import_required`.
2. Distinguer plateforme source, contexte/territoire, et méthode de collecte.
3. Ne jamais publier de fausses données ; une édition périmée conserve la dernière version avec un badge « Mise à jour en attente ».
4. Secrets exclusivement côté serveur (jamais `NEXT_PUBLIC_*`).
5. Une plateforme en panne ne bloque pas les autres.

## Tests

```bash
npm test              # tests unitaires + intégration (vitest)
npx playwright test   # E2E (nécessite le serveur dev + base locale)
```
