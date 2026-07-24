# Répartition des tâches — Top YouTube HMI

Objectif : économiser les 300 crédits Kiro. Les tâches mécaniques sont réalisées
directement dans le projet. Kiro ne doit recevoir que les tâches marquées `K`.

## D — Tâches réalisées directement

- [x] D1. Lire intégralement le cahier YouTube et auditer le dépôt.
- [x] D2. Documenter les composants, tables et services réutilisables.
- [x] D3. Créer les types et constantes du domaine YouTube.
  - Types de vidéos et de chaînes, statuts, modes de collecte et statuts charts.
  - Nom, sous-titre et méthodologie publics.
- [x] D4. Créer les schémas Zod.
  - IDs vidéo/chaîne/playlist, URL YouTube, source de chaîne, paramètres de
    collecte et réponse `videos.list`.
- [x] D5. Implémenter les calculs purs du classement V1.
  - Delta des compteurs, nouvelle vidéo, snapshot manquant, compteur en baisse,
    exclusion des Shorts, agrégation par chanson et départage.
- [x] D6. Implémenter les contrôles purs avant publication.
  - Erreurs bloquantes et avertissements du cahier des charges.
- [x] D7. Ajouter les tests unitaires des tâches D3 à D6.
- [x] D8. Préparer les exigences et le design d'intégration pour Kiro.
- [x] D9. Créer les composants visuels simples après stabilisation de K1.
  - Badges, états vides, avertissements et affichage de progression.
- [ ] D10. Créer les formulaires simples après stabilisation des routes K3/K4.
  - Configuration de collecte et édition des champs éditoriaux.
- [ ] D11. Compléter la documentation utilisateur et `.env.local.example`
  après stabilisation des contrats serveur.

## K — Tâches complexes réservées à Kiro

- [x] K1. Migration Supabase spécialisée et RLS.
  - Étendre le schéma existant sans dupliquer `chart_editions`,
    `chart_entries`, `sync_runs` et `chart_audit_logs`.
  - Tables chaînes, vidéos, associations et snapshots ; contraintes
    d'idempotence ; suppression contrôlée ; politiques RLS.
- [x] K2. Client serveur YouTube Data API v3.
  - Validation d'une chaîne, playlist d'uploads, pagination, lots de vidéos,
    métadonnées/statistiques, quota, timeouts, erreurs partielles et secrets.
- [ ] K3. Orchestrateur de collecte.
  - Verrou par période, protection double clic, reprise, annulation,
    progression, journal, idempotence et statut `COMPLETED_WITH_WARNINGS`.
- [ ] K4. Découverte et file de vérification.
  - Nouvelles vidéos par chaînes approuvées, règles labels/distributeurs,
    dédoublonnage, association assistée et audit.
- [ ] K5. Persistance transactionnelle des snapshots et calcul du brouillon.
  - Snapshots immuables, cas d'indisponibilité, rattachement multi-vidéos,
    branchement des fonctions pures D5/D6 et création du Top 20 brouillon.
- [ ] K6. Routes serveur administratives sécurisées.
  - Sources, vidéos, collectes, progression, validation, recalcul, édition,
    prévisualisation et actions sensibles.
- [ ] K7. Publication, révision et restauration atomiques.
  - Archivage, programmation annulable, cache, historique et rollback sans
    état public partiel.
- [ ] K8. Tests d'intégration et de permissions.
  - API mockée, RLS, concurrence, collecte partielle, publication, archivage et
    restauration.

## Dépendances et ordre économique

1. Donner uniquement K1 à Kiro.
2. Après validation de K1, réaliser directement D9 pendant que Kiro fait K2.
3. Donner K3, puis K4, puis K5 séparément à Kiro.
4. Réaliser directement D10 sur les contrats stabilisés.
5. Donner K6 et K7 séparément à Kiro.
6. Donner K8 seulement après réussite des tests unitaires directs.
7. Réaliser D11 et la vérification finale directement.

## Prompt initial minimal pour Kiro

> Lis `.kiro/steering/*` puis `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`.
> Inspecte les migrations existantes. Exécute uniquement K1. Réutilise les
> tables charts existantes, ne code aucun client API, aucune route et aucune UI.
> Fournis la migration, les contraintes, les politiques RLS et les tests SQL
> pertinents. Ne coche K1 qu'après vérification.

## Prompt K2 minimal pour Kiro

> Lis `.kiro/steering/*` puis
> `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`. K1 est terminée
> et vérifiée. Exécute uniquement K2 : le client serveur YouTube Data API v3.
> Implémente la validation d'une chaîne, la récupération de sa playlist
> d'uploads, la pagination de `playlistItems.list` et les appels `videos.list`
> par lots de 50 maximum pour les métadonnées, disponibilités et statistiques.
> Utilise exclusivement l'API officielle, garde la clé API côté serveur et
> réutilise les constantes, types et schémas Zod présents dans
> `src/lib/youtube`. Gère clairement les timeouts, quota épuisé, clé invalide,
> chaîne ou vidéo introuvable, vidéo privée/supprimée et réponses partielles,
> sans journaliser le secret. Ajoute des tests avec API simulée pour le succès,
> la pagination, le découpage en lots, les erreurs 403/404 et les IDs manquants.
> Ne modifie ni la migration K1, ni Supabase, ni les routes, ni l'orchestrateur,
> ni l'interface. Ne commence pas K3. Arrête-toi après les tests de K2 et fournis
> la liste exacte des fichiers modifiés et des contrôles exécutés.

## Prompt K3 minimal pour Kiro

> Lis `.kiro/steering/*` puis
> `.kiro/specs/youtube-ranking/{requirements,design,tasks}.md`. K1 et K2 sont
> terminées et vérifiées. Exécute uniquement K3 : l'orchestrateur serveur de
> collecte YouTube. Réutilise `sync_runs`, la source
> `youtube_hmi_weekly_delta`, les types existants et le client K2.
>
> Implémente un cycle idempotent avec création ou récupération d'une exécution,
> verrou atomique par source et période, protection contre le double clic,
> étapes explicites, progression persistée, compteurs, avertissements, erreurs,
> demande d'annulation, heartbeat, reprise sûre après interruption et statuts
> `PENDING`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED` et
> `CANCELLED`. Deux appels concurrents pour la même période ne doivent jamais
> lancer deux collectes.
>
> K3 doit seulement coordonner des étapes injectables. Ne développe pas encore
> la découverte métier K4, la persistance des snapshots ou le calcul du
> brouillon K5, les routes K6, la publication K7 ou l'interface. N'appelle pas
> réellement YouTube dans les tests.
>
> Inspecte d'abord le schéma réel de `sync_runs`. Privilégie sa colonne
> `metadata`. Si une garantie atomique exige une modification SQL, crée une
> migration idempotente minimale sans modifier K1 et explique pourquoi elle est
> indispensable. Ne l'applique pas sur Supabase hosted sans demande explicite.
>
> Ajoute des tests avec dépendances simulées pour : démarrage normal, double
> appel séquentiel, concurrence réelle, progression monotone, avertissements,
> erreur fatale, annulation avant et pendant une étape, reprise d'une exécution
> interrompue, verrou actif et verrou devenu obsolète. Vérifie que les secrets
> et réponses brutes de l'API ne sont jamais écrits dans `sync_runs`.
>
> Exécute les tests, TypeScript, ESLint sans avertissement et le build. Ne coche
> K3 qu'après réussite. Arrête-toi ensuite et fournis les fichiers modifiés,
> l'éventuelle migration non appliquée et les résultats exacts des contrôles.
