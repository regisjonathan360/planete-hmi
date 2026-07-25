# Classement YouTube HMI

Le classement mesure les nouvelles vues mondiales obtenues pendant une semaine
par les vidéos officielles approuvées. Plusieurs vidéos peuvent être agrégées
pour une même chanson. Les Shorts sont exclus. Une collecte ne publie jamais
automatiquement : elle produit un brouillon qui doit être contrôlé par un
administrateur.

## Configuration

1. Dans Google Cloud, activer **YouTube Data API v3** pour le projet.
2. Créer une clé API serveur, la restreindre à cette API et aux environnements
   autorisés.
3. Définir `YOUTUBE_API_KEY` côté serveur uniquement. Ne jamais utiliser de
   préfixe `NEXT_PUBLIC_`.
4. Définir `SUPABASE_SECRET_KEY` et `CRON_SECRET` côté serveur.
5. Dans Vercel, ajouter ces valeurs pour les environnements souhaités, puis
   redéployer l’application.

Le fichier `.env.local.example` contient les noms attendus sans valeur secrète.

## Première collecte

1. Appliquer les migrations Supabase après revue et sauvegarde.
2. Ajouter puis vérifier au moins une chaîne YouTube dans l’administration.
3. Lancer une collecte complète pour la période hebdomadaire voulue.
4. Examiner les nouvelles vidéos, les associer aux chansons et approuver
   uniquement les vidéos officielles éligibles.
5. Relancer le calcul, corriger toutes les erreurs bloquantes et prévisualiser.
6. Publier immédiatement ou programmer la publication.

## Publication et restauration

La publication est une transaction PostgreSQL unique : l’historique immuable,
le snapshot public, l’archivage de l’ancienne édition et le nouveau statut sont
écrits ensemble. Le public ne peut donc jamais voir une mise à jour partielle.

Après publication, utiliser **Créer une révision** avant toute correction. Le
snapshot public reste inchangé jusqu’à la republication. L’historique conserve
chaque version et permet de restaurer une publication antérieure ; la
restauration crée elle-même une nouvelle version auditée.

Une publication programmée est traitée par `/api/cron/youtube-publish`. Elle
peut être annulée tant qu’elle n’a pas été exécutée. Le cron exige
`Authorization: Bearer <CRON_SECRET>`.

Sur le forfait Vercel Hobby, ce traitement s’exécute une fois par jour à
12:00 UTC. Une publication programmée peut donc être exécutée avec un délai
maximal d’environ 24 heures. Un forfait autorisant les crons fréquents permet
de réduire ce délai.
