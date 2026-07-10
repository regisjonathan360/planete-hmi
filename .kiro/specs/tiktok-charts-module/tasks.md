# Implementation Plan: Module de Classement TikTok

## Overview

Ce plan implémente le module TikTok Charts pour Planète HMI. Il suit l'architecture existante (chart_sources, chart_editions, chart_entries) et le patron du module Audiomack. L'implémentation est structurée en couches : schéma de base de données → types et constantes → logique métier (collector, score engine, chart builder) → API routes → panneau d'administration → section homepage HMI Shorts.

## Tasks

- [x] 1. Schéma de base de données et seed data
  - [x] 1.1 Créer la migration SQL pour les tables tiktok_videos, tiktok_sounds, tiktok_featured_shorts
    - Créer le fichier de migration Supabase avec les 3 tables, contraintes UNIQUE, CHECK, FK, et les index nécessaires
    - Appliquer les politiques RLS : deny public write, service_role full access
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 11.2_
  - [x] 1.2 Créer le seed SQL pour les chart_sources TikTok
    - Insérer les 3 enregistrements chart_sources (tiktok_haiti_global, tiktok_haiti_en_montee, tiktok_haiti_nouveautes)
    - Vérifier platform = "tiktok", metric_unit = "posts_count", market_code = "HT"
    - _Requirements: 5.1, 5.5, 6.1_

- [x] 2. Types, constantes et schémas de validation
  - [x] 2.1 Créer les types TypeScript du module (`src/lib/tiktok/types.ts`)
    - Définir toutes les interfaces : TikTokVideo, TikTokSound, ScoreCoefficients, CollectionResult, etc.
    - S'aligner avec les interfaces définies dans le design document
    - _Requirements: 2.5, 3.1, 8.1, 8.2_
  - [x] 2.2 Créer les constantes (`src/lib/tiktok/constants.ts`)
    - Hashtags haïtiens par défaut, mots-clés genres musicaux, coefficients de score par défaut
    - Source keys pour les 3 classements, fenêtre de nouveautés (14 jours)
    - _Requirements: 2.2, 2.3, 3.2, 5.4_
  - [x] 2.3 Créer les schémas Zod de validation (`src/lib/tiktok/schemas.ts`)
    - Schéma de validation pour les réponses de l'API TikTok (vidéos)
    - Schéma pour les paramètres de collecte et les entrées admin
    - _Requirements: 2.5, 1.1_
  - [ ]* 2.4 Écrire le test de propriété pour la normalisation des vidéos
    - **Property 1: Video normalization completeness**
    - **Validates: Requirements 2.5**

- [x] 3. Client API TikTok
  - [x] 3.1 Implémenter le client API (`src/lib/tiktok/api-client.ts`)
    - Authentification OAuth2 client_credentials avec TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
    - Méthode queryVideos avec pagination (cursor)
    - Exponential backoff sur 429 (base 4 : 1s, 4s, 16s), max 3 retries
    - Logging structuré de chaque requête
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.4_
  - [ ]* 3.2 Écrire les tests unitaires pour le client API
    - Mock des réponses (success, 401, 429, 500)
    - Vérifier le retry logic (nombre de tentatives, délais)
    - Vérifier que les credentials ne fuient pas côté client
    - _Requirements: 1.1, 1.3, 11.4_

- [x] 4. Collector TikTok
  - [x] 4.1 Implémenter le collector (`src/lib/tiktok/collector.ts`)
    - Orchestrer les 4 stratégies de requête : région HT, hashtags, keywords, artistes
    - Déduplication par video_id (upsert)
    - Agrégation métriques par music_id → tiktok_sounds
    - Nouveaux sons → validation_status = "a_verifier"
    - Enregistrement sync_run (running → success / error / partial_error)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 8.3, 9.3, 9.4_
  - [ ]* 4.2 Écrire le test de propriété pour la déduplication
    - **Property 2: Deduplication idempotence**
    - **Validates: Requirements 2.6**
  - [ ]* 4.3 Écrire le test de propriété pour le statut par défaut des nouveaux sons
    - **Property 6: New sounds default to validation queue**
    - **Validates: Requirements 4.1, 8.3**

- [x] 5. Checkpoint — Vérifier la collecte
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Score Engine
  - [x] 6.1 Implémenter le score engine (`src/lib/tiktok/score-engine.ts`)
    - Calcul du score composite avec normalisation min-max et coefficients pondérés
    - Calcul de la croissance 7 jours (growth_7d) : ((C - P) / P) * 100, cas P=0 géré
    - Calcul de la diversité créateurs (unique_creators = count distinct usernames)
    - Recalcul déclenché après chaque collecte réussie
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 6.2 Écrire le test de propriété pour le score pondéré
    - **Property 3: Score computation respects weighted formula**
    - **Validates: Requirements 3.1, 3.2**
  - [ ]* 6.3 Écrire le test de propriété pour la croissance 7 jours
    - **Property 4: 7-day growth formula correctness**
    - **Validates: Requirements 3.3**
  - [ ]* 6.4 Écrire le test de propriété pour la diversité créateurs
    - **Property 5: Creator diversity equals distinct username count**
    - **Validates: Requirements 3.4**

- [x] 7. Chart Builder
  - [x] 7.1 Implémenter le chart builder (`src/lib/tiktok/chart-builder.ts`)
    - Filtrer uniquement les sons validation_status = "valide"
    - Global : tri par score composite descendant
    - En montée : tri par growth_7d descendant
    - Nouveautés : filter first_seen_at ≤ 14j + tri par score descendant
    - Créer chart_entries avec metric_value = total_videos, metric_unit = "posts_count"
    - Créer/mettre à jour chart_edition (draft)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.2, 6.3_
  - [ ]* 7.2 Écrire le test de propriété — seuls les sons validés dans les classements
    - **Property 7: Only validated sounds appear in charts**
    - **Validates: Requirements 4.3, 4.4, 4.5**
  - [ ]* 7.3 Écrire le test de propriété — tri Global par score
    - **Property 8: Global chart sorted by composite score descending**
    - **Validates: Requirements 5.2**
  - [ ]* 7.4 Écrire le test de propriété — tri En montée par croissance
    - **Property 9: En montée chart sorted by 7-day growth descending**
    - **Validates: Requirements 5.3**
  - [ ]* 7.5 Écrire le test de propriété — filtre et tri Nouveautés
    - **Property 10: Nouveautés filter and sort**
    - **Validates: Requirements 5.4**
  - [ ]* 7.6 Écrire le test de propriété — metric_value = publications count
    - **Property 11: Chart entries metric_value equals publications count**
    - **Validates: Requirements 6.3**

- [x] 8. Checkpoint — Vérifier le score engine et chart builder
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Sources et intégration chart_editions
  - [x] 9.1 Implémenter le module sources (`src/lib/tiktok/sources.ts`)
    - Définition des 3 chart_sources avec leurs source_keys
    - Fonctions helper pour récupérer/créer les éditions liées
    - Intégration avec platform_tracks (platform = "tiktok", external_id = music_id)
    - _Requirements: 5.1, 6.1, 6.2, 6.4_

- [x] 10. API Routes — Cron et Admin
  - [x] 10.1 Implémenter la route cron (`src/app/api/cron/tiktok/route.ts`)
    - POST protégé par CRON_SECRET
    - Déclenche collector.runCollection() + score engine + chart builder
    - Retourne le résultat (succès/erreur) en JSON
    - _Requirements: 9.2, 9.3, 9.4, 11.1_
  - [x] 10.2 Implémenter la route collecte manuelle (`src/app/api/admin/tiktok/collect/route.ts`)
    - POST protégé par requireAdmin
    - Déclenche la même collecte que le cron
    - _Requirements: 9.1, 7.3, 6.6_
  - [x] 10.3 Implémenter la route validation (`src/app/api/admin/tiktok/validate/route.ts`)
    - POST protégé par requireAdmin
    - Body : { music_id, status: "valide" | "refuse" }
    - Met à jour tiktok_sounds.validation_status
    - _Requirements: 4.3, 4.4, 4.5_
  - [x] 10.4 Implémenter les routes publish/restore/cancel (`src/app/api/admin/tiktok/publish/route.ts`, `restore/route.ts`, `cancel/route.ts`)
    - Réutiliser publishEdition, restoreLastPublished, cancelChanges existants
    - POST protégé par requireAdmin pour chaque action
    - _Requirements: 6.4, 6.5, 7.5_
  - [x] 10.5 Implémenter la route entries (`src/app/api/admin/tiktok/entries/route.ts`)
    - PATCH protégé par requireAdmin
    - Permet réordonnement, masquage, exclusion, override titre/artiste/artwork
    - _Requirements: 7.4_
  - [x] 10.6 Implémenter les routes HMI Shorts (`src/app/api/admin/tiktok/shorts/route.ts`)
    - GET : liste des vidéos featured actuelles
    - POST : sélection/désélection de vidéos (max 10, sons validés uniquement)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [ ]* 10.7 Écrire le test de propriété — contraintes HMI Shorts
    - **Property 12: HMI Shorts constraints**
    - **Validates: Requirements 10.3, 10.4**

- [x] 11. Checkpoint — Vérifier les API routes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Panneau d'administration — Page et composants
  - [x] 12.1 Créer la page admin TikTok (`src/app/admin/tiktok/page.tsx`)
    - Server component avec guard requireAdmin
    - Charge les données initiales (sons, éditions, stats)
    - _Requirements: 7.1, 6.6_
  - [x] 12.2 Implémenter le composant TikTokManager (`src/app/admin/tiktok/TikTokManager.tsx`)
    - Dashboard principal avec résumé stats (total sons, pending, validés, statut édition, dernière collecte)
    - Onglets Global / En montée / Nouveautés
    - Bouton de collecte manuelle avec feedback progress
    - Interface entièrement en français
    - _Requirements: 7.2, 7.3, 7.6, 4.6_
  - [x] 12.3 Implémenter le composant ValidationQueue (`src/app/admin/tiktok/ValidationQueue.tsx`)
    - Liste des sons avec status "a_verifier"
    - Affiche : titre, artiste associé, publications count, score
    - Boutons Valider / Refuser par son
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 12.4 Implémenter le composant ChartEditor (`src/app/admin/tiktok/ChartEditor.tsx`)
    - Éditeur d'entrées par onglet de classement
    - Actions : réordonnement drag-and-drop, masquage, exclusion avec raison, override champs
    - Boutons Publier, Restaurer, Annuler
    - _Requirements: 7.4, 7.5, 5.6_
  - [x] 12.5 Implémenter le composant HmiShortsSelector (`src/app/admin/tiktok/HmiShortsSelector.tsx`)
    - Sélection de vidéos pour la homepage (recherche, preview)
    - Affiche video_id, thumbnail, titre du son, username créateur
    - Contrôle max 10 vidéos, uniquement sons validés
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 13. Section publique HMI Shorts
  - [x] 13.1 Implémenter le composant HMI Shorts pour la homepage
    - Récupère les vidéos featured depuis chart_published_snapshots ou tiktok_featured_shorts
    - Affiche max 10 vidéos avec thumbnail, titre son, username
    - Design responsive (desktop / mobile)
    - _Requirements: 10.2, 10.3, 11.3_

- [ ] 14. Tests d'intégration et validation finale
  - [ ]* 14.1 Écrire les tests d'intégration pour le flux complet
    - Collecte end-to-end avec API TikTok mockée → vérifier tiktok_videos, tiktok_sounds, sync_runs
    - Workflow draft → publish → restore → cancel
    - Cron route : validation CRON_SECRET, format réponse
    - _Requirements: 9.2, 9.3, 6.4, 6.5_
  - [ ]* 14.2 Écrire les tests unitaires pour les schémas Zod
    - Entrées valides et invalides pour chaque schéma
    - Cas limites : champs manquants, types incorrects
    - _Requirements: 2.5_

- [x] 15. Final checkpoint — Validation complète
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (12 propriétés définies dans le design)
- Unit tests validate specific examples and edge cases
- Le module réutilise les fonctions existantes du système de charts (publishEdition, restoreLastPublished, cancelChanges, requireAdmin)
- Tous les composants admin sont en français conformément aux requirements
- fast-check est utilisé comme bibliothèque de property-based testing avec vitest

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "3.1"] },
    { "id": 2, "tasks": ["2.4", "3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "9.1"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6"] },
    { "id": 7, "tasks": ["10.7", "12.1"] },
    { "id": 8, "tasks": ["12.2", "12.3", "12.4", "12.5"] },
    { "id": 9, "tasks": ["13.1", "14.1", "14.2"] }
  ]
}
```
