# 🎵 Module TikTok Charts — Guide de mise en route

## Étapes restantes (manuelles)

### 1. Appliquer les migrations SQL

Ouvre le **SQL Editor** de ton dashboard Supabase (local ou hosted) et exécute dans l'ordre :

```bash
# Fichier 1 : Crée les tables tiktok_videos, tiktok_sounds, tiktok_featured_shorts
supabase/migrations/20260709090000_create_tiktok_tables.sql

# Fichier 2 : Insère les 3 chart_sources TikTok
supabase/migrations/20260709100000_seed_tiktok_chart_sources.sql
```

> Si tu utilises `supabase db push` ou `supabase migration up`, les fichiers seront appliqués automatiquement.

### 2. Configurer les credentials TikTok

Dans `.env.local` (déjà préparé), remplis :

```env
TIKTOK_CLIENT_KEY=ton_client_key_ici
TIKTOK_CLIENT_SECRET=ton_client_secret_ici
```

Pour obtenir ces credentials :
1. Va sur https://developers.tiktok.com
2. Crée une app avec accès à l'API Research
3. Récupère Client Key + Client Secret

### 3. Configurer CRON_SECRET (production)

En production (Vercel), ajoute la variable d'environnement :

```env
CRON_SECRET=un-secret-long-et-aléatoire
```

Le fichier `vercel.json` est déjà configuré pour lancer la collecte tous les jours à 6h UTC.

### 4. Vérifier le fonctionnement

1. Démarre le serveur : `npm run dev`
2. Va sur http://localhost:3000/admin/tiktok
3. Connecte-toi en admin
4. Clique "Lancer la collecte" (nécessite les credentials TikTok)

### 5. Premier workflow

1. **Collecte** → Les vidéos sont récupérées, les sons créés en status "à vérifier"
2. **Validation** → Onglet "Validation", valide/refuse chaque son
3. **Publication** → Onglet "Global", clique "Publier"
4. **Homepage** → Les HMI Shorts apparaissent sur /charts

---

## Architecture des fichiers créés

```
src/lib/tiktok/
├── api-client.ts       # Client API TikTok Research
├── collector.ts        # Orchestrateur de collecte
├── score-engine.ts     # Calcul des scores
├── chart-builder.ts    # Génération des 3 classements
├── sources.ts          # Helpers chart_sources/editions
├── schemas.ts          # Validation Zod
├── types.ts            # Types TypeScript
├── constants.ts        # Configuration
└── __tests__/          # 16 property-based tests

src/app/admin/tiktok/
├── page.tsx            # Page admin (server)
├── TikTokManager.tsx   # Dashboard + tabs
├── ValidationQueue.tsx # File de validation
├── ChartEditor.tsx     # Éditeur d'entrées
└── HmiShortsSelector.tsx

src/app/api/
├── cron/tiktok/route.ts
├── admin/tiktok/collect/route.ts
├── admin/tiktok/validate/route.ts
├── admin/tiktok/publish/route.ts
├── admin/tiktok/restore/route.ts
├── admin/tiktok/cancel/route.ts
├── admin/tiktok/entries/route.ts
├── admin/tiktok/shorts/route.ts
├── admin/tiktok/sounds/route.ts
└── shorts/route.ts (public)

src/components/HmiShorts.tsx  # Section homepage

supabase/migrations/
├── 20260709090000_create_tiktok_tables.sql
└── 20260709100000_seed_tiktok_chart_sources.sql
```
