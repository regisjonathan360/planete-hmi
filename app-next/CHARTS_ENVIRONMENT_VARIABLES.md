# Variables d'environnement — Module Classements

Toutes les variables sont côté **serveur uniquement** sauf indication contraire.  
Aucun secret ne doit être préfixé par `NEXT_PUBLIC_`.

| Variable | Requis | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui (publique) | URL du projet Supabase (local : `http://127.0.0.1:54321`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui (publique) | Clé anon (RLS appliquée). |
| `SUPABASE_SECRET_KEY` | oui (serveur) | Clé service-role (contourne la RLS). Jamais côté navigateur. |
| `YOUTUBE_API_KEY` | non | Clé YouTube Data API v3 (pour le mode `youtube_hmi_weekly_delta`). |
| `SPOTIFY_CLIENT_ID` | non | ID client Spotify (enrichissement métadonnées uniquement). |
| `SPOTIFY_CLIENT_SECRET` | non | Secret client Spotify. |
| `AUDIOMACK_CONSUMER_KEY` | non | Clé consommateur Audiomack. |
| `AUDIOMACK_CONSUMER_SECRET` | non | Secret consommateur Audiomack. |
| `AUDIOMACK_HAITI_CHART_ENDPOINT` | non | URL du flux partenaire Haïti (laisser vide tant qu'aucun accès accordé). |
| `APPLE_TEAM_ID` | non | Team ID Apple Developer. |
| `APPLE_KEY_ID` | non | Key ID Apple Music API. |
| `APPLE_PRIVATE_KEY` | non | Clé privée Apple (PEM). Exclusivement côté serveur. |
| `APPLE_STOREFRONT` | non | Storefront testé (défaut : `ht`). |
| `APPLE_CHART_TYPES` | non | Types de chart (défaut : `songs`). |
| `APPLE_CHART_LIMIT` | non | Limite (défaut : `200`). |
| `APPLE_WORLDWIDE_GENRE_ID` | non | ID genre pour filtrage Worldwide. |
| `TIKTOK_CLIENT_KEY` | non | Clé client TikTok. |
| `TIKTOK_CLIENT_SECRET` | non | Secret client TikTok. |

## Où les déclarer

- **Dev local** : `.env.local` (fourni par `supabase start`, ne pas committer).
- **Vercel** : Settings → Environment Variables (type « Sensitive » pour les secrets).
- **Supabase Cloud (Edge Functions)** : Dashboard → Project Settings → Edge Functions → Secrets ; ou `supabase secrets set KEY=value`.
