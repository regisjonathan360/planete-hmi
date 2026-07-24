# Exigences — Top YouTube HMI

Ce document synthétise le cahier des charges YouTube fourni le 24 juillet 2026.
En cas de divergence, le cahier original reste prioritaire.

## Règles non négociables

1. Le classement mesure les nouvelles vues mondiales des vidéos officielles
   suivies par Planet HMI ; il n'est pas territorial Haïti.
2. L'unité classée est la chanson. Plusieurs vidéos éligibles peuvent être
   agrégées pour une même chanson.
3. Les Shorts sont exclus du classement principal.
4. Seule la YouTube Data API v3 est autorisée. Aucun scraping HTML.
5. `YOUTUBE_API_KEY` reste exclusivement côté serveur.
6. La collecte crée ou met à jour un brouillon et ne publie jamais directement.
7. Une vidéo non vérifiée ne peut pas entrer dans une publication.
8. Les snapshots et données sources sont immuables. Les corrections
   éditoriales sont stockées séparément et auditées.
9. Seules les éditions `PUBLISHED` sont lisibles publiquement.
10. La publication est atomique et l'édition précédente reste restaurable.

## Calcul V1

- `nouvelles vues vidéo = vues fin − vues début`
- Une vidéo publiée pendant la période peut utiliser zéro comme valeur de départ.
- Une ancienne vidéo sans snapshot de départ est exclue pour la période courante.
- Un compteur qui diminue crée une anomalie à résoudre.
- `nouvelles vues chanson = somme des vidéos éligibles`
- Tri : nouvelles vues, nouveaux likes, nouveaux commentaires, vues totales,
  chanson la plus récente.
- Aucun score composite arbitraire en V1.

## Workflow

Sources approuvées → collecte serveur → nouvelles vidéos → file de vérification
→ association chanson/artistes → snapshots → calcul → Top 20 brouillon →
contrôles → prévisualisation admin → publication → archivage.

## Critères de sécurité

- Toutes les routes d'administration vérifient le rôle côté serveur.
- RLS interdit l'écriture publique et limite la lecture publique aux éditions
  publiées.
- Verrou de collecte, idempotence, validation des paramètres et des URL.
- Aucun secret ni payload sensible dans les logs ou réponses publiques.

## États

- Collecte : `PENDING`, `RUNNING`, `COMPLETED`,
  `COMPLETED_WITH_WARNINGS`, `FAILED`, `CANCELLED`.
- Vidéo : `UNREVIEWED`, `NEEDS_INFORMATION`, `APPROVED`, `EXCLUDED`,
  `DUPLICATE`, `IGNORED`.
- Classement : `EMPTY`, `COLLECTING`, `NEEDS_REVIEW`, `DRAFT`, `READY`,
  `SCHEDULED`, `PUBLISHED`, `ARCHIVED`, `FAILED`.
