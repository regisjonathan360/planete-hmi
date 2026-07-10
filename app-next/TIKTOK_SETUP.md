# Connexion TikTok des artistes - Mise en route

Planet HMI utilise TikTok Login Kit et Display API pour synchroniser uniquement
les comptes qui ont donne leur autorisation. La Research API historique n'est
pas necessaire pour ce parcours.

## 1. Appliquer la migration Supabase

La migration suivante cree les comptes artistes, les connexions TikTok
chiffrees, les videos consenties et les releves quotidiens :

```text
supabase/migrations/20260710061409_create_artist_tiktok_connections.sql
```

Avec la CLI :

```bash
supabase migration up --local
```

Pour la base distante, utiliser le workflow de migration Supabase habituel du
projet avant de mettre l'interface en production.

## 2. Creer l'application TikTok

1. Ouvrir https://developers.tiktok.com et creer l'application Planet HMI.
2. Ajouter les produits Login Kit et Display API.
3. Ajouter la plateforme Web.
4. Enregistrer une URL de retour HTTPS statique :

```text
https://ton-domaine.com/api/tiktok/callback
```

L'URL doit etre strictement identique a `TIKTOK_REDIRECT_URI`. TikTok refuse
les parametres et les fragments dans cette URL.

Demander uniquement les scopes suivants :

```text
user.info.basic
user.info.profile
user.info.stats
video.list
```

## 3. Ajouter les variables serveur

Ajouter ces valeurs dans `.env.local` pour le developpement, puis dans les
variables Production, Preview et Development de Vercel :

```env
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://ton-domaine.com/api/tiktok/callback
TIKTOK_TOKEN_ENCRYPTION_KEY=
TIKTOK_SYNC_MAX_PAGES=10
CRON_SECRET=
```

Generer la cle de chiffrement une seule fois :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Ne jamais prefixer ces variables par `NEXT_PUBLIC_`. Changer la cle de
chiffrement sans reconnecter les artistes rend les anciens jetons illisibles.

## 4. Configurer Supabase Auth

Dans Authentication > URL Configuration :

- definir le domaine public de Planet HMI comme Site URL ;
- autoriser `https://ton-domaine.com/auth/callback` ;
- conserver une URL locale de test si necessaire.

Les artistes creent un compte Planet HMI par e-mail, puis connectent TikTok
depuis `/espace-artiste`.

## 5. Tester puis soumettre a TikTok

Le parcours a montrer dans la video d'examen TikTok est :

1. creation ou connexion du compte Planet HMI ;
2. clic sur Connecter TikTok ;
3. ecran de consentement TikTok ;
4. retour dans l'espace artiste ;
5. affichage du profil et des videos ;
6. actualisation et retrait de la connexion.

Le site expose deja `/privacy` et `/terms`. Ces pages doivent decrire les
donnees TikTok collectees, leur conservation et le retrait de l'autorisation.

## 6. Synchronisation

`vercel.json` appelle `/api/cron/tiktok` chaque jour. Vercel envoie
`Authorization: Bearer <CRON_SECRET>`. Le cron renouvelle les jetons proches de
l'expiration, actualise le profil, les videos et un releve quotidien des
metriques.

Le client historique `src/lib/tiktok/api-client.ts` reste reserve au module
Research API existant. La connexion des artistes utilise les fichiers
`user-api.ts`, `connections.ts` et `user-sync.ts`.

## Securite

- Le mot de passe TikTok ne transite jamais par Planet HMI.
- Les jetons TikTok sont chiffres en AES-256-GCM avant stockage.
- Les tables de connexion sont interdites aux roles `anon` et `authenticated`.
- Chaque route revalide la session Supabase cote serveur.
- Retirer TikTok revoque l'autorisation distante et supprime les donnees
  locales de la connexion.
