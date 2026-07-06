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
