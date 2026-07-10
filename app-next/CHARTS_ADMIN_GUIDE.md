# Guide d'administration — Classements Planète HMI

## Accès
- URL : `/admin/login`
- Un compte avec le rôle `admin` dans `user_roles` est requis.

## Workflow hebdomadaire

1. **Vendredi** : les sources automatiques (YouTube Data API, Apple Music API) tentent une collecte. Les sources manuelles restent en attente.
2. **Samedi** : un retry automatique relance les collectes échouées. Le marquage de péremption s'exécute.
3. **Dimanche** : l'administrateur importe les classements manuels (`/admin/charts/import`), résout les correspondances incertaines (`/admin/charts/review`), vérifie les artistes, puis valide les éditions.
4. **Lundi (8 h, heure d'Haïti)** : l'administrateur publie les éditions validées depuis `/admin/charts/history`.

## Import d'un classement
1. Aller à `/admin/charts/import`.
2. Sélectionner la plateforme/source.
3. Télécharger le template CSV si besoin.
4. Coller le JSON (tableau de lignes) ou convertir depuis le CSV.
5. **Prévisualiser** : vérifier position source, correspondance, confiance, éligibilité haïtienne, doublons.
6. **Créer l'édition** (brouillon).
7. Aller à `/admin/charts/history` pour valider puis publier.

## Résolution des correspondances
- `/admin/charts/review` : les entrées dont la confiance est < 80 % apparaissent.
- Coller l'UUID de la chanson cible et « Associer », ou « Rejeter ».

## Publication / Rollback
- Depuis `/admin/charts/history`, utiliser les boutons **Valider → Publier**.
- En cas d'erreur : **Annuler la publication** (rollback) ramène au statut « validée ».
- La publication recalcule les mouvements, les meilleures positions, les semaines au classement, et invalide le cache public.

## Péremption
- Si une source n'est pas actualisée pour la semaine courante, l'édition publiée est marquée « périmée » (badge « Mise à jour en attente »).
- L'édition reste visible (jamais supprimée, jamais dupliquée sous une nouvelle date).

---

## Page d'administration Audiomack (v1 implémentée)

Une nouvelle interface d'administration est disponible et opérationnelle.

### Accès
- URL : `/admin` (tableau de bord) puis `/admin/audiomack`.
- Connexion : `/admin/login` (e-mail + mot de passe Supabase Auth).
- L'accès exige un compte avec le rôle `admin` dans `user_roles`.

### Créer un administrateur
1. Créer l'utilisateur dans Supabase Auth (Dashboard → Authentication, ou `supabase.auth.signUp`).
2. Lui attribuer le rôle admin :
   ```sql
   insert into user_roles (user_id, role)
   values ('<uuid-utilisateur>', 'admin')
   on conflict (user_id) do update set role = 'admin';
   ```

### Appliquer la migration
La couche admin ajoute des colonnes et tables. Appliquer :
```bash
supabase db push          # base hébergée
# ou, en local :
supabase migration up
```
Migration concernée : `20260708090000_admin_charts_control.sql`.

### Ce que permet la page `/admin/audiomack`
- **Collecter depuis Audiomack** : importe le Weekly 100 Haiti en **brouillon**, affiche un résumé (musiques / albums / artistes) et la date de collecte.
- **Zone « À valider »** : statut haïtien de chaque artiste — *à vérifier* (`pending_review`), *validé* (`verified_haitian`), *refusé* (`rejected`), *masqué* (`is_active = false`). Seuls les artistes **validés** sont publiés.
- **Top musiques / Top albums / Top artistes** : les musiques sont pleinement éditables ; albums et artistes sont des agrégations dérivées des musiques visibles.
- **Édition manuelle** : corriger titre, artiste, cover, lien ; masquer, exclure (retrait non haïtien), supprimer, monter/descendre. Les positions se **recalculent automatiquement** (si le n°3 part, le n°4 devient n°3). Chaque mouvement est journalisé dans `chart_entry_history`.
- **Publication contrôlée** :
  - *Publier le classement* : fige la version publique dans `chart_published_snapshots` (seules les entrées validées + visibles apparaissent).
  - *Restaurer la version publiée* : annule les modifications non publiées.
  - *Annuler les changements* : revient à l'ordre source Audiomack brut.
- **Isolation brouillon/public** : le site public lit uniquement le dernier snapshot publié. Tant que « Publier » n'est pas cliqué, les modifications restent invisibles.

### Architecture multi-plateforme
Tout est indexé par `chart_sources.platform`. Pour ajouter YouTube, Apple Music ou Spotify : réutiliser `chart_published_snapshots`, `recomputeAdminEdition`, `publishEdition`, et brancher un provider de collecte comme le module Audiomack (`src/lib/audiomack/`).
