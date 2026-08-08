# Implementation Plan: Audiomack Multi-Chart Ranking

## Overview

Ce plan implémente le système multi-genres Audiomack avec classement composite, extraction de statistiques, reclassement automatique, prévisualisation audio embed, et pages publiques multi-onglets. L'implémentation suit un ordre incrémental : schéma DB → modules core → API → script Playwright → UI admin → pages publiques → workflow GitHub Actions → tests.

## Tasks

- [ ] 1. Database migrations and schema extensions
  - [ ] 1.1 Add new columns to `chart_sources` table
    - Add `weight` (numeric 0.0-5.0, default 1.0), `display_order` (integer, default 0), `is_composite_source` (boolean, default false) columns
    - Create Supabase migration file in `app-next/supabase/migrations/`
    - Set default genres as enabled: `all`, `afrosounds`, `hip-hop-rap`, `caribbean`, `latin`, `r-b`, `gospel`, `pop`
    - _Requirements: 2.2, 2.4, 3.1, 3.2_

  - [ ] 1.2 Add new columns to `chart_entries` table
    - Add `score_composite` (numeric(12,2)), `score_stats` (numeric(14,2)), `stats_extracted_at` (timestamptz), `stats_status` (text with CHECK constraint: 'pending'|'extracted'|'failed'|'unavailable')
    - _Requirements: 4.1, 12.3, 13.2_

  - [ ] 1.3 Create `chart_entry_metrics` table
    - Create table with columns: id (uuid PK), chart_entry_id (FK → chart_entries), metric_type (text), metric_value (bigint), extracted_at (timestamptz)
    - Add UNIQUE constraint on (chart_entry_id, metric_type)
    - Create indexes on chart_entry_id and metric_type
    - _Requirements: 12.4_

  - [ ] 1.4 Create `composite_contributions` table
    - Create table with columns: id (uuid PK), composite_entry_id (FK → chart_entries), source_key (text), genre_id (text), source_position (integer), weight (numeric), contribution (numeric)
    - Add UNIQUE constraint on (composite_entry_id, source_key)
    - Create index on composite_entry_id
    - _Requirements: 4.7_

  - [ ] 1.5 Create `reclassification_history` table
    - Create table with columns: id (uuid PK), chart_edition_id (FK → chart_editions), applied_at (timestamptz), applied_by (text), coefficients (jsonb), previous_order (jsonb), new_order (jsonb)
    - Add CHECK constraint ensuring coefficients contains 'plays', 'likes', 'reposts' keys
    - Create index on chart_edition_id
    - _Requirements: 13.8_

  - [ ] 1.6 Configure RLS policies for new tables
    - Add read-only public access for chart_entry_metrics and composite_contributions
    - Add admin-only write access for all new tables
    - Add admin-only access for reclassification_history
    - _Requirements: 8.1_

- [ ] 2. Core library modules
  - [ ] 2.1 Implement slug extraction utility
    - Create `app-next/src/lib/audiomack/slug-utils.ts`
    - Implement `extractSlugsFromUrl(sourceTrackUrl: string): { artistSlug: string; trackSlug: string } | null`
    - Implement `generateFallbackSlug(name: string): string` for normalization (lowercase, alphanumeric + hyphens)
    - Implement `buildEmbedUrl(artistSlug: string, trackSlug: string): string`
    - Implement `validateEmbedUrl(url: string): boolean`
    - _Requirements: 6.3, 6.4, 9.1, 9.2, 9.3, 9.5_

  - [ ]* 2.2 Write property test for slug extraction (Property 12)
    - **Property 12: Slug extraction and embed URL round-trip**
    - **Validates: Requirements 6.3, 6.4, 9.3, 9.5**
    - File: `app-next/tests/unit/slug-extraction.property.test.ts`

  - [ ] 2.3 Implement composite builder module
    - Create `app-next/src/lib/audiomack/composite-builder.ts`
    - Implement `buildComposite(supabase, config)` — fetches published editions, computes scores using formula `Σ (weight × (101 − position))`
    - Implement tiebreaker logic: genreCount desc, then bestPosition asc
    - Implement `saveCompositeEdition(supabase, entries, options)` — persists as draft edition with source_key `audiomack_haiti_composite`
    - Limit output to 20 entries max
    - Only include sources with published edition AND weight > 0
    - Store contributions per entry
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 2.4 Write property tests for composite builder (Properties 6, 7, 10)
    - **Property 6: Composite score formula correctness**
    - **Property 7: Composite ordering (score + tiebreaker)**
    - **Property 10: Top 20 truncation invariant**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - File: `app-next/tests/unit/composite-builder.property.test.ts`

  - [ ] 2.5 Implement weight validation and normalization utilities
    - Create `app-next/src/lib/audiomack/weight-utils.ts`
    - Implement `validateWeight(value: number): boolean` (0.0 ≤ v ≤ 5.0)
    - Implement `normalizeWeights(weights: Map<string, number>): Map<string, number>` (compute percentages)
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 2.6 Write property tests for weight validation (Properties 4, 5)
    - **Property 4: Weight range validation**
    - **Property 5: Weight normalization sum**
    - **Validates: Requirements 3.1, 3.5**
    - File: `app-next/tests/unit/weight-validation.property.test.ts`

  - [ ] 2.7 Implement stats extractor module
    - Create `app-next/src/lib/audiomack/stats-extractor.ts`
    - Implement `extractTrackStats(trackUrl: string): Promise<TrackStats>` — fetches track page HTML, parses plays/likes/reposts/comments
    - Implement `extractEditionStats(supabase, editionId, onProgress?)` — batch extraction with 2s delay, progress callback, individual error handling
    - Mark entries as 'extracted', 'failed', or 'unavailable' based on outcome
    - Stop early after 10 consecutive failures
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 12.8_

  - [ ] 2.8 Implement reclassification engine module
    - Create `app-next/src/lib/audiomack/reclassification-engine.ts`
    - Implement `computeScoreStats(stats, coefficients)` — formula: (plays × c_plays) + (likes × c_likes) + (reposts × c_reposts)
    - Implement `previewReclassification(supabase, editionId, coefficients)` — returns before/after comparison
    - Implement `applyReclassification(supabase, editionId, coefficients)` — updates positions, stores history
    - Entries without stats retain original position, placed after entries with stats
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [ ]* 2.9 Write property tests for reclassification (Properties 13, 14)
    - **Property 13: Score_Stats computation and reclassification ordering**
    - **Property 14: Reclassification no-stats fallback**
    - **Validates: Requirements 13.2, 13.3, 13.4**
    - File: `app-next/tests/unit/score-stats.property.test.ts`

  - [ ] 2.10 Implement filtered positions utility
    - Create `app-next/src/lib/audiomack/filtered-positions.ts`
    - Implement `computeFilteredPositions(entries, maxDisplay = 20)` — assigns positions 1..min(E, 20) sequentially
    - Ensure all collected entries remain stored regardless of display limit
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 2.11 Write property test for filtered positions (Property 11)
    - **Property 11: Filtered positions sequential invariant**
    - **Validates: Requirements 5.3, 5.5**
    - File: `app-next/tests/unit/filtered-positions.property.test.ts`

- [ ] 3. Checkpoint - Core modules validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. API routes implementation
  - [ ] 4.1 Implement `/api/admin/audiomack/genres` route (GET/PATCH)
    - GET: return all genre configurations from `chart_sources` where platform = 'audiomack'
    - PATCH: update is_enabled, weight, display_order for a given source_key
    - Validate weight range (0.0-5.0) with Zod schema
    - Admin auth check
    - _Requirements: 2.1, 2.2, 3.1, 3.3, 8.1_

  - [ ] 4.2 Implement `/api/admin/audiomack/genres/activated` route (GET)
    - Return list of genres where is_enabled = true (and optionally is_automatic = true)
    - Used by Playwright script to determine which genres to collect
    - _Requirements: 2.3, 10.2_

  - [ ] 4.3 Implement `/api/admin/audiomack/compute-composite` route (POST)
    - Call `buildComposite()` with current weights from DB
    - Call `saveCompositeEdition()` to persist as draft
    - Return computed entries and warnings (< 3 sources → warning)
    - Admin auth check
    - _Requirements: 4.1, 4.5, 4.6, 8.3, 8.7_

  - [ ] 4.4 Implement `/api/admin/audiomack/extract-stats` route (POST)
    - Accept editionId parameter
    - Call `extractEditionStats()` with batch processing
    - Return extraction results (extracted count, failed count)
    - Admin auth check
    - _Requirements: 12.1, 12.2, 12.7_

  - [ ] 4.5 Implement `/api/admin/audiomack/extract-stats/progress` route (GET SSE)
    - Server-Sent Events endpoint for real-time extraction progress
    - Stream progress updates (total, completed, failed, currentTrack)
    - _Requirements: 12.7_

  - [ ] 4.6 Implement `/api/admin/audiomack/reclassify` route (POST)
    - Accept mode ('preview' | 'apply'), editionId, coefficients
    - Preview mode: call `previewReclassification()`, return comparison
    - Apply mode: call `applyReclassification()`, return historyId
    - Admin auth check
    - _Requirements: 13.1, 13.5, 13.6, 13.7_

  - [ ] 4.7 Implement `/api/admin/audiomack/reclassify/history` route (GET)
    - Return reclassification history for a given editionId
    - Include coefficients, applied_at, applied_by
    - Admin auth check
    - _Requirements: 13.8_

  - [ ] 4.8 Implement `/api/charts/audiomack` route (GET)
    - Public route (no auth)
    - Return composite edition (published) + individual genre editions (published)
    - Limit each to 20 entries with filtered positions
    - Include contributions data for composite entries
    - Use ISR-compatible caching headers
    - _Requirements: 5.1, 7.1, 7.3, 11.2, 11.3_

  - [ ] 4.9 Extend existing `/api/admin/charts/collect-local` route
    - Accept `sourceKey` parameter to differentiate genres
    - Extract and store `artist_slug` and `track_slug` from sourceTrackUrl during sync
    - Validate slug/embed URL before storage
    - _Requirements: 1.4, 9.1, 9.2, 9.4, 9.5_

- [ ] 5. Checkpoint - API routes validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Playwright script modifications
  - [ ] 6.1 Modify `collect-playwright.mjs` for multi-genre collection
    - Add initial API call to `/api/admin/audiomack/genres/activated` to get enabled genres
    - Accept `genres` CLI parameter (comma-separated genreIds or "all")
    - Loop sequentially over each genre with navigation to `https://audiomack.com/top/songs?country=haiti&genre={genreId}`
    - Send collected entries per genre to `/collect-local` with appropriate `sourceKey`
    - Add configurable delay between genres (3-5 seconds)
    - Continue on individual genre failure, log error
    - Call `/compute-composite` after all genres collected
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 10.4, 10.5_

  - [ ]* 6.2 Write batch fault tolerance property test (Property 1)
    - **Property 1: Batch fault tolerance**
    - **Validates: Requirements 1.3, 12.6**
    - File: `app-next/tests/unit/batch-tolerance.property.test.ts`
    - Test that arbitrary subset failures don't abort remaining tasks

  - [ ]* 6.3 Write genre filtering property test (Property 2)
    - **Property 2: Genre filtering and edition isolation**
    - **Validates: Requirements 1.4, 1.5, 2.3**
    - File: `app-next/tests/unit/genre-filtering.property.test.ts`

- [ ] 7. Admin UI extensions
  - [ ] 7.1 Create `GenreConfigPanel` component
    - Create `app-next/src/components/admin/GenreConfigPanel.tsx`
    - Display list of all genres with toggle (enabled/disabled), weight slider (0.0-5.0), drag-to-reorder
    - Show normalized weight percentages
    - Show dashboard: last collection date, entry count, current edition status per genre
    - Call PATCH `/api/admin/audiomack/genres` on changes
    - _Requirements: 2.1, 3.3, 3.5, 8.1, 8.6_

  - [ ] 7.2 Add composite preview and publish controls to AudiomackManager
    - Add "Calculer composite" button calling POST `/compute-composite`
    - Display composite preview (top 20 with scores, genre badges)
    - Add "Publier composite" button with warning if < 3 sources published
    - Real-time recalculation on weight change (preview only, no published editions affected)
    - _Requirements: 8.3, 8.4, 8.5, 8.7_

  - [ ] 7.3 Add stats extraction UI to AudiomackManager
    - Add "Extraire les stats" button for current edition
    - Display progress bar with SSE connection to `/extract-stats/progress`
    - Show extracted stats next to each entry (formatted plays, like percentage)
    - Mark entries with 'unavailable' or 'failed' status visually
    - _Requirements: 12.1, 12.5, 12.7_

  - [ ] 7.4 Add reclassification UI to AudiomackManager
    - Add "Recalculer par stats" button
    - Add configurable coefficients inputs (plays, likes, reposts) with defaults 1.0, 5.0, 3.0
    - Display before/after comparison table (original vs new positions, position change arrows)
    - Add "Appliquer" and "Rejeter" buttons
    - Show reclassification history list
    - _Requirements: 13.1, 13.5, 13.6, 13.9_

  - [ ] 7.5 Add single-genre and all-genres collection triggers
    - Add "Collecter ce genre" button per genre in GenreConfigPanel
    - Add "Collecter tous les genres" button
    - Call appropriate API endpoint with genre selection
    - _Requirements: 8.2_

- [ ] 8. Public page components
  - [ ] 8.1 Create `AudiomackEmbedPreview` component
    - Create `app-next/src/components/charts/AudiomackEmbedPreview.tsx`
    - Desktop: popover on hover with 300ms debounce, destroy iframe on mouse leave
    - Mobile: bottom sheet on tap, destroy iframe on close
    - Singleton pattern: only one preview active at a time
    - Iframe: height 110px, width 100%, src = embed URL from slugs
    - Fallback: if slugs missing, show external link to Audiomack page
    - Lazy-load: iframe created only on interaction, never at page load
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 6.8, 11.1_

  - [ ] 8.2 Create `/charts/audiomack` page with multi-tab navigation
    - Create `app-next/src/app/charts/audiomack/page.tsx`
    - SSR/ISR with 1h revalidation
    - Tab navigation: "Best Of" (composite) tab first, then individual genre tabs
    - Display per tab: genre name, last update date, entry count, Top 20 entries
    - Each entry shows: filtered position, artwork, title, artist(s), position change, genre badges (composite only)
    - Empty state for genres without published edition
    - Prefetch active tab + next tab data for < 200ms tab switch
    - No browser-side calls to Audiomack for chart data
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 11.2, 11.3, 11.4, 11.5_

- [ ] 9. Checkpoint - UI components validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. GitHub Actions workflow updates
  - [ ] 10.1 Update `audiomack-collect.yml` for multi-genre support
    - Add `genres` input parameter (comma-separated genreIds or "all", default "all")
    - On cron trigger: collect all genres with `is_enabled = true` AND `is_automatic = true`
    - On manual trigger: accept genre selection via workflow_dispatch input
    - Pass `genres` parameter to Playwright script
    - Add configurable delay environment variable
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 11. Final integration and wiring
  - [ ] 11.1 Wire GenreConfigPanel into existing AudiomackManager layout
    - Import and render GenreConfigPanel as a collapsible section in AudiomackManager
    - Ensure state synchronization between genre config and composite preview
    - _Requirements: 8.1_

  - [ ] 11.2 Add composite source entry in `chart_sources` seed data
    - Insert `audiomack_haiti_composite` source with `is_composite_source = true`
    - Ensure it's excluded from collection but included in display
    - _Requirements: 4.5_

  - [ ]* 11.3 Write integration test for composite end-to-end flow
    - Test: multi-genre collection → composite calculation → publication → public API
    - Mock Supabase client with test data
    - _Requirements: 4.1, 4.2, 4.7, 5.1_
    - File: `app-next/tests/integration/composite-e2e.test.ts`

  - [ ]* 11.4 Write integration test for stats extraction flow
    - Test: extract stats → store metrics → reclassify → verify positions
    - Mock HTTP responses for track pages
    - _Requirements: 12.2, 12.4, 13.2, 13.7_
    - File: `app-next/tests/integration/stats-extraction.test.ts`

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design (14 properties, 11 covered by PBT)
- Unit tests validate specific examples and edge cases
- The project uses `vitest --run` for test execution and `fast-check` v4.9.0 for property-based tests
- All code is TypeScript, targeting Next.js 16 with React 19 and Supabase
- Admin routes require authentication; public routes use ISR caching

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["1.6", "2.1", "2.5", "2.10"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.6", "2.7", "2.8", "2.11"] },
    { "id": 3, "tasks": ["2.4", "2.9", "4.1", "4.2", "4.9"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "4.8"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "7.1", "7.5", "8.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "8.2"] },
    { "id": 8, "tasks": ["10.1", "11.1", "11.2"] },
    { "id": 9, "tasks": ["11.3", "11.4"] }
  ]
}
```
