# Implementation Plan: Community Interactions Arena

## Overview

Plan d'implémentation pour l'arène d'interactions communautaires de Planète HMI. Le module couvre le schéma PostgreSQL (15+ tables avec RLS), les fonctions de logique métier (validation, points, niveaux, modération), les API routes (publiques + admin), l'infrastructure Realtime, les composants frontend React/Next.js, et les tests (PBT + unitaires + intégration). Chaque tâche s'appuie sur les précédentes pour un développement incrémental.

## Tasks

- [x] 1. Database schema & migrations
  - [x] 1.1 Create the initial migration file with core tables
    - Create `supabase/migrations/YYYYMMDDHHMMSS_arene_schema.sql`
    - Define tables: `community_profiles`, `reactions`, `comments`, `battles`, `battle_votes`
    - Include all CHECK constraints, indexes, and UNIQUE constraints as specified in design
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 1.2 Create migration for gamification and moderation tables
    - Define tables: `challenges`, `challenge_completions`, `badges`, `member_badges`, `daily_points_log`
    - Define tables: `activity_feed`, `moderation_reports`, `moderation_actions`, `banned_terms`, `notifications`
    - Include all CHECK constraints, indexes, UNIQUE constraints, and foreign keys
    - _Requirements: 14.1, 14.6_

  - [x] 1.3 Create migration for RLS policies
    - Enable RLS on all community tables
    - Apply SELECT policies (anon + auth) on public tables
    - Apply INSERT/UPDATE/DELETE policies restricted to `auth.uid()` on user-owned rows
    - Apply admin-only policies on `battles`, `challenges`, `badges`, `banned_terms`
    - Apply system-only (SECURITY DEFINER) policies for `member_badges`, `activity_feed`, `notifications`
    - _Requirements: 14.7, 14.8, 15.1, 15.2_

  - [x] 1.4 Create migration for the `award_points` RPC function
    - Implement `award_points(p_member_id, p_category, p_points)` as SECURITY DEFINER
    - Include daily cap logic (50 for reactions, 40 for comments, no cap for votes/challenges)
    - Include level-up detection and profile update
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 3.6, 3.7, 4.5, 4.8_

  - [x] 1.5 Create migration for materialized view `leaderboard_cache`
    - Create materialized view with top 50 profiles sorted by points DESC, created_at ASC
    - Add refresh function and index
    - _Requirements: 7.3, 13.4_

- [x] 2. Core library functions — Validation & Moderation
  - [x] 2.1 Implement pseudo validation (`src/lib/arene/validation.ts`)
    - Export `validatePseudo(pseudo: string, bannedTerms: string[]): ValidationResult`
    - Rules: 3-30 chars, letters/digits/hyphens/underscores only, no banned terms (case-insensitive)
    - Export `validateCommentBody(body: string): ValidationResult`
    - Rules: trimmed length between 1 and 500 chars
    - Export Zod schemas: `pseudoSchema`, `commentBodySchema`, `battleSchema`, `challengeSchema`, `badgeSchema`
    - _Requirements: 2.4, 2.6, 4.2, 15.3_

  - [ ]* 2.2 Write property tests for pseudo validation
    - **Property 1: Pseudo validation**
    - **Validates: Requirements 2.4, 2.6**
    - File: `src/lib/arene/validation.test.ts`
    - Generators: arbitrary strings [0..50], Unicode chars, banned term lists

  - [ ]* 2.3 Write property tests for comment body validation
    - **Property 5: Comment body validation**
    - **Validates: Requirements 4.2**
    - File: `src/lib/arene/validation.test.ts`
    - Generators: strings [0..1000] with whitespace variations

  - [x] 2.4 Implement banned term filter (`src/lib/arene/moderation.ts`)
    - Export `containsBannedTerm(text: string, bannedTerms: string[]): boolean`
    - Case-insensitive substring matching
    - Export `filterComment(body: string, bannedTerms: string[]): ModerationResult`
    - _Requirements: 4.6, 10.1_

  - [ ]* 2.5 Write property tests for banned term filter
    - **Property 7: Banned term filter**
    - **Validates: Requirements 4.6, 10.1**
    - File: `src/lib/arene/moderation.test.ts`
    - Generators: arbitrary strings, lists of banned terms

- [x] 3. Core library functions — Points, Levels & Battles
  - [x] 3.1 Implement level computation (`src/lib/arene/levels.ts`)
    - Export `computeNiveau(points: number): Niveau`
    - Thresholds: étoile [0,99], constellation [100,499], nébuleuse [500,1499], galaxie [1500,4999], univers [5000+]
    - Export `NIVEAU_THRESHOLDS` constant
    - _Requirements: 7.1_

  - [ ]* 3.2 Write property tests for level computation
    - **Property 12: Niveau threshold mapping**
    - **Validates: Requirements 7.1**
    - File: `src/lib/arene/levels.test.ts`
    - Generators: nat(100000)

  - [x] 3.3 Implement points logic (`src/lib/arene/points.ts`)
    - Export `DAILY_CAPS: Record<PointCategory, number | null>`
    - Export `calculateAwardablePoints(dailyTotal: number, requested: number, cap: number | null): number`
    - Export `POINTS_PER_ACTION: Record<ActionType, number>` (reaction=1, comment=2, vote=3)
    - _Requirements: 3.6, 3.7, 4.5, 4.8, 5.3, 7.5, 7.6_

  - [ ]* 3.4 Write property tests for daily points cap
    - **Property 4: Daily points cap enforcement**
    - **Validates: Requirements 3.6, 3.7, 4.5, 4.8, 7.5, 7.6**
    - File: `src/lib/arene/points.test.ts`
    - Generators: sequences of actions, daily totals [0..100]

  - [ ]* 3.5 Write property tests for points monotonicity
    - **Property 13: Points monotonically non-decreasing**
    - **Validates: Requirements 7.4**
    - File: `src/lib/arene/points.test.ts`
    - Generators: sequences of valid actions with running totals

  - [x] 3.6 Implement battle winner logic (`src/lib/arene/battles.ts`)
    - Export `determineWinner(votesA: number, votesB: number): 'side_a' | 'side_b' | 'tie'`
    - Export `isBattleActive(endsAt: string): boolean`
    - _Requirements: 5.5, 5.6, 5.7_

  - [ ]* 3.7 Write property tests for battle winner determination
    - **Property 10: Battle winner determination**
    - **Validates: Requirements 5.6, 5.7**
    - File: `src/lib/arene/battles.test.ts`
    - Generators: pairs (votesA, votesB) ∈ ℕ²

  - [ ]* 3.8 Write property tests for vote temporal guard
    - **Property 9: Vote temporal guard**
    - **Validates: Requirements 5.5**
    - File: `src/lib/arene/battles.test.ts`
    - Generators: timestamps past/future relative to now

- [x] 4. Core library functions — Date utils, Pagination, Rate limiting
  - [x] 4.1 Implement relative date formatting (`src/lib/arene/date-utils.ts`)
    - Export `formatRelativeDate(timestamp: string): string`
    - Rules: "il y a X min" (<60min), "il y a X h" (<24h), "il y a X j" (<7d), "DD/MM/YYYY" (≥7d)
    - _Requirements: 4.4, 9.4_

  - [ ]* 4.2 Write property tests for relative date formatting
    - **Property 18: Relative date formatting**
    - **Validates: Requirements 4.4, 9.4**
    - File: `src/lib/arene/date-utils.test.ts`
    - Generators: timestamps within 30 days range

  - [x] 4.3 Implement pagination helpers (`src/lib/arene/pagination.ts`)
    - Export `parsePagination(params: URLSearchParams): { page: number; pageSize: number }`
    - Default pageSize=20, max=50, min=1
    - Export `buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta`
    - _Requirements: 13.3_

  - [ ]* 4.4 Write property tests for pagination bounds
    - **Property 25: Pagination bounds**
    - **Validates: Requirements 13.3**
    - File: `src/lib/arene/pagination.test.ts`
    - Generators: integers [0..100] for page_size

  - [x] 4.5 Implement rate limiting (`src/lib/arene/rate-limit.ts`)
    - Export `checkRateLimit(memberId: string, action: 'comment' | 'reaction', timestamps: Date[]): RateLimitResult`
    - Rules: 1 comment / 10s, 10 reactions / 60s
    - Export `checkApiRateLimit(ip: string, memberId: string | null): ApiRateLimitResult`
    - Rules: 60 req/min per IP, 30 writes/min per member
    - _Requirements: 10.8, 15.4, 15.5_

  - [ ]* 4.6 Write property tests for rate limiting
    - **Property 22: Rate limiting enforcement**
    - **Validates: Requirements 10.8, 15.4, 15.5**
    - File: `src/lib/arene/rate-limit.test.ts`
    - Generators: sequences of timestamps

  - [x] 4.7 Implement activity feed grouping (`src/lib/arene/activity-grouping.ts`)
    - Export `groupActivities(items: ActivityItem[]): GroupedActivityItem[]`
    - Group same type + same target within 60-minute window
    - Show count and most recent timestamp
    - _Requirements: 9.5_

  - [ ]* 4.8 Write property tests for activity grouping
    - **Property 17: Activity grouping within 60-minute window**
    - **Validates: Requirements 9.5**
    - File: `src/lib/arene/activity-grouping.test.ts`
    - Generators: lists of activities with timestamps within variable windows

- [x] 5. Checkpoint — Core library complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. API routes — Public endpoints (reactions, comments, profile)
  - [x] 6.1 Implement profile API (`src/app/api/arene/profile/route.ts`)
    - GET: fetch authenticated user's community profile (create if first access)
    - PATCH: update pseudo and/or avatar with Zod validation
    - Use `createClient` server pattern, return 401 if unauthenticated
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 15.1_

  - [x] 6.2 Implement reactions API (`src/app/api/arene/reactions/route.ts`)
    - POST: toggle reaction (add or remove), validate with Zod
    - Call `award_points` RPC on add, handle cap reached response
    - Enforce rate limit (10 reactions / 60s)
    - Insert activity_feed entry
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 15.1_

  - [ ]* 6.3 Write property tests for reaction toggle round-trip
    - **Property 2: Reaction toggle round-trip**
    - **Validates: Requirements 3.2, 3.3**
    - File: `src/lib/arene/reactions.test.ts`
    - Test the toggle logic in isolation

  - [ ]* 6.4 Write property tests for reaction uniqueness invariant
    - **Property 3: Reaction uniqueness invariant**
    - **Validates: Requirements 3.4, 14.2**
    - File: `src/lib/arene/reactions.test.ts`

  - [x] 6.5 Implement comments API (`src/app/api/arene/comments/route.ts`)
    - GET: paginated comments by thread (anti-chronological, 20/page)
    - POST: create comment with Zod validation, banned term check, rate limit (1/10s)
    - DELETE: soft-delete own comment (set status='deleted')
    - Call `award_points` RPC on create
    - Insert activity_feed entry
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 10.1, 10.8, 15.1_

  - [ ]* 6.6 Write property tests for comment ordering
    - **Property 6: Comment ordering**
    - **Validates: Requirements 4.3**
    - File: `src/app/api/arene/__tests__/comments.test.ts`

  - [x] 6.7 Implement battle vote API (`src/app/api/arene/battles/[id]/vote/route.ts`)
    - POST: cast vote with Zod validation
    - Check battle is active (temporal guard), check no existing vote (uniqueness)
    - Call `award_points` RPC (3 points, no cap)
    - Update battle vote counts
    - Insert activity_feed entry
    - _Requirements: 5.3, 5.4, 5.5, 15.1_

  - [ ]* 6.8 Write property tests for vote uniqueness and permanence
    - **Property 8: Vote uniqueness and permanence**
    - **Validates: Requirements 5.3, 5.4, 14.3**
    - File: `src/app/api/arene/__tests__/votes.test.ts`

  - [x] 6.9 Implement activity feed API (`src/app/api/arene/activity/route.ts`)
    - GET: paginated activity feed (30 items default), with grouping logic
    - Apply formatRelativeDate for display
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

  - [ ]* 6.10 Write property tests for activity feed ordering
    - **Property 16: Activity feed ordering**
    - **Validates: Requirements 9.1**
    - File: `src/lib/arene/activity-grouping.test.ts`

  - [x] 6.11 Implement leaderboard API (`src/app/api/arene/leaderboard/route.ts`)
    - GET: top 50 members sorted by points DESC, ties by created_at ASC
    - Use materialized view for performance
    - ISR revalidation tag
    - _Requirements: 7.3, 13.4_

  - [ ]* 6.12 Write property tests for leaderboard sorting
    - **Property 14: Leaderboard sorting**
    - **Validates: Requirements 7.3**
    - File: `src/app/api/arene/__tests__/leaderboard.test.ts`

  - [x] 6.13 Implement moderation report API (`src/app/api/arene/reports/route.ts`)
    - POST: report a comment (reason enum: insulte, spam, discours_haineux, autre)
    - Enforce unique(reporter, comment), increment comment report_count
    - Auto-hide comment when report_count >= 3
    - _Requirements: 10.2, 10.3, 10.4_

  - [ ]* 6.14 Write property tests for report uniqueness and auto-hide
    - **Property 19: Report uniqueness**
    - **Property 20: Auto-hide threshold**
    - **Validates: Requirements 10.3, 10.4**
    - File: `src/app/api/arene/__tests__/moderation.test.ts`

- [x] 7. API routes — Admin endpoints
  - [x] 7.1 Implement admin battles CRUD (`src/app/api/admin/arene/battles/route.ts`)
    - GET: list all battles (active + ended), paginated
    - POST: create battle with Zod validation (title, description, sides, duration)
    - Use `requireAdmin` guard pattern
    - Create `src/app/api/admin/arene/battles/[id]/route.ts` for PATCH/DELETE
    - _Requirements: 5.1, 15.2_

  - [x] 7.2 Implement admin challenges CRUD (`src/app/api/admin/arene/challenges/route.ts`)
    - GET/POST for listing and creating challenges
    - Create `src/app/api/admin/arene/challenges/[id]/route.ts` for PATCH
    - Validate: title, description, challenge_type, target_count, reward_points, duration
    - _Requirements: 6.1, 6.5, 15.2_

  - [x] 7.3 Implement admin moderation API (`src/app/api/admin/arene/moderation/route.ts`)
    - GET: list hidden comments (moderation queue)
    - POST `[id]/action`: validate, delete, or restore a comment
    - On delete: send notification to author, check suspension threshold (5 deletions / 30 days)
    - _Requirements: 10.5, 10.6, 10.7, 15.2_

  - [ ]* 7.4 Write property tests for suspension logic
    - **Property 21: Suspension after repeated moderation**
    - **Validates: Requirements 10.7**
    - File: `src/app/api/arene/__tests__/moderation.test.ts`

  - [x] 7.5 Implement admin badges CRUD (`src/app/api/admin/arene/badges/route.ts`)
    - GET: list all badges
    - POST: create badge with Zod validation (name, description, icon_url, type, condition)
    - Create `[id]/route.ts` for PATCH
    - _Requirements: 8.4, 8.5, 15.2_

  - [x] 7.6 Implement admin banned terms CRUD (`src/app/api/admin/arene/banned-terms/route.ts`)
    - GET: list all banned terms
    - POST: add term (max 100 chars, max 500 total terms)
    - DELETE `[id]`: remove term
    - _Requirements: 10.9, 15.2_

  - [ ]* 7.7 Write property tests for authentication guard
    - **Property 23: Authentication guard on write endpoints**
    - **Validates: Requirements 15.1, 15.6**
    - File: `src/app/api/arene/__tests__/auth-guard.test.ts`
    - Test all write endpoints reject unauthenticated requests with 401

  - [ ]* 7.8 Write property tests for no email exposure
    - **Property 24: No email exposure in public responses**
    - **Validates: Requirements 15.7**
    - File: `src/app/api/arene/__tests__/security.test.ts`

- [x] 8. Checkpoint — API layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Realtime infrastructure
  - [x] 9.1 Implement AreneRealtimeManager (`src/lib/arene/realtime.ts`)
    - Client-side class managing Supabase Realtime subscriptions
    - Max 5 simultaneous subscriptions with LRU eviction
    - Reconnection logic: 5s interval, max 5 attempts
    - Cleanup method for navigation
    - _Requirements: 13.1, 13.2, 13.6_

  - [x] 9.2 Create RealtimeProvider context (`src/components/arene/RealtimeProvider.tsx`)
    - React context wrapping AreneRealtimeManager
    - Expose `subscribe()` and `connectionStatus`
    - Auto-cleanup on unmount
    - Show disconnection indicator when status is 'disconnected'
    - _Requirements: 9.6, 13.6_

- [x] 10. Frontend — Layout and navigation
  - [x] 10.1 Create AreneLayout (`src/app/arene/layout.tsx`)
    - Server component with StageLightsBackground + ShootingStars (respects prefers-reduced-motion)
    - AreneTabNav for sub-route navigation (battles, défis, discussions, classement-membres)
    - MurActivite sidebar on desktop, hidden on mobile
    - Wrap children in RealtimeProvider
    - _Requirements: 1.1, 1.2, 1.5, 11.2, 11.6, 12.5_

  - [x] 10.2 Create AreneTabNav component (`src/components/arene/AreneTabNav.tsx`)
    - Tab navigation: Battles, Défis, Discussions, Classement
    - Active tab highlighting with accessible focus indicators
    - Responsive: horizontal scroll on mobile if needed
    - _Requirements: 1.5, 11.3, 11.5_

  - [x] 10.3 Create AuthCallToAction component (`src/components/arene/AuthCallToAction.tsx`)
    - Displayed when user is not authenticated
    - Links to `/connexion` with appropriate messaging
    - _Requirements: 1.3_

  - [x] 10.4 Implement default redirect logic
    - `/arene` → redirect to `/arene/battles`
    - Unknown sub-routes under `/arene` → redirect to `/arene/battles`
    - _Requirements: 1.6, 1.7_

- [x] 11. Frontend — Shared components
  - [x] 11.1 Create ReactionPicker component (`src/components/arene/ReactionPicker.tsx`)
    - Display 6 cosmic reaction types with counts
    - Toggle behavior: highlight user's existing reactions
    - Disabled state for unauthenticated users
    - Minimum 44×44px touch targets
    - Call POST /api/arene/reactions on click
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 11.3_

  - [x] 11.2 Create CommentForm component (`src/components/arene/CommentForm.tsx`)
    - Textarea with live character count (max 500)
    - Submit button disabled when empty or over limit
    - Show inline error on validation failure or moderation block
    - ARIA labels and keyboard accessible
    - _Requirements: 4.1, 4.2, 4.6, 11.5_

  - [x] 11.3 Create CommentList and CommentItem components (`src/components/arene/CommentList.tsx`)
    - Paginated list (20/page) with "Voir plus" button
    - CommentItem: pseudo, niveau badge, relative date, reactions, report/delete actions
    - Delete available only for own comments
    - Report button opens reason picker (insulte, spam, discours_haineux, autre)
    - _Requirements: 4.3, 4.4, 4.7, 10.2, 10.3_

  - [x] 11.4 Create MurActivite component (`src/components/arene/MurActivite.tsx`)
    - Display grouped activity items with relative dates
    - Subscribe to Realtime for new items (prepend animation)
    - "Voir plus" button loads 30 more items
    - Sidebar mode (desktop) and fullwidth mode
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.2_

  - [x] 11.5 Create NotificationToast component (`src/components/arene/NotificationToast.tsx`)
    - Toast for level-up, badge earned, points cap reached
    - Auto-dismiss after 5 seconds
    - Accessible: role="alert", aria-live="polite"
    - _Requirements: 7.2, 8.6_

  - [x] 11.6 Create NiveauBadge component (`src/components/arene/NiveauBadge.tsx`)
    - Visual badge showing cosmic level with appropriate icon
    - Used in leaderboard rows, comment items, activity feed
    - _Requirements: 7.2, 8.2_

- [ ] 12. Frontend — Battles page
  - [~] 12.1 Create BattlesPage (`src/app/arene/battles/page.tsx`)
    - Server component fetching active battles
    - Display ActiveBattleList (active) + BattleHistory (ended, paginated 20/page)
    - _Requirements: 5.2, 5.8, 5.9_

  - [x] 12.2 Create BattleCard component (`src/components/arene/BattleCard.tsx`)
    - Side-by-side layout (desktop), stacked (mobile)
    - VoteProgressBar with real-time animated updates
    - Countdown timer with onExpired callback
    - Vote buttons disabled if already voted, battle ended, or unauthenticated
    - Subscribe to Realtime for live vote count updates
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 11.1, 11.3, 13.1, 13.5_

  - [~] 12.3 Create VoteProgressBar component (`src/components/arene/VoteProgressBar.tsx`)
    - Animated horizontal bar showing percentage split
    - Label with vote counts and percentages
    - WCAG AA contrast ratios
    - _Requirements: 5.2, 11.4_

  - [~] 12.4 Create Countdown component (`src/components/arene/Countdown.tsx`)
    - Display days/hours/minutes/seconds remaining
    - Trigger onExpired when reaching zero
    - Update every second (requestAnimationFrame)
    - _Requirements: 5.2, 5.5, 5.6_

- [ ] 13. Frontend — Défis, Discussions, Classement pages
  - [~] 13.1 Create DefisPage (`src/app/arene/defis/page.tsx`)
    - List active challenges with DefiCard components
    - Show individual progress bar, participant count, time remaining
    - _Requirements: 6.3, 6.4_

  - [~] 13.2 Create DefiCard component (`src/components/arene/DefiCard.tsx`)
    - Progress bar: actions done / actions required
    - Type label, reward amount, participant count
    - Time remaining display
    - _Requirements: 6.1, 6.3, 6.5_

  - [~] 13.3 Create DiscussionsPage (`src/app/arene/discussions/page.tsx`)
    - List threads (free discussions + linked to songs/battles/challenges)
    - ThreadCard with latest comment preview, comment count, last activity date
    - Link to full thread view with CommentList + CommentForm
    - _Requirements: 4.1, 4.3, 12.2_

  - [~] 13.4 Create ClassementPage (`src/app/arene/classement-membres/page.tsx`)
    - LeaderboardTable with top 50 members
    - MemberRow: rank, pseudo, avatar, NiveauBadge, points
    - Highlight current user's row if present
    - ISR with revalidation on points change
    - _Requirements: 7.3, 13.4_

- [ ] 14. Frontend — Admin pages
  - [~] 14.1 Create admin layout (`src/app/admin/arene/layout.tsx`)
    - Use existing `requireAdmin` pattern for server-side auth guard
    - Navigation: Battles, Défis, Modération, Badges, Termes interdits
    - _Requirements: 15.2_

  - [~] 14.2 Create admin battles page (`src/app/admin/arene/battles/page.tsx`)
    - List all battles with status indicators
    - Create battle form: title, description, side selection (from existing songs/artists), duration
    - Edit/cancel battle actions
    - _Requirements: 5.1, 12.1_

  - [~] 14.3 Create admin challenges page (`src/app/admin/arene/defis/page.tsx`)
    - List challenges with status
    - Create challenge form: title, description, type, target_count, reward_points, duration
    - _Requirements: 6.1, 6.5_

  - [~] 14.4 Create admin moderation page (`src/app/admin/arene/moderation/page.tsx`)
    - Moderation queue: hidden comments with report details
    - Actions: validate (restore), delete (with reason), restore
    - Show reporter count and reasons per comment
    - _Requirements: 10.5, 10.6_

  - [~] 14.5 Create admin badges page (`src/app/admin/arene/badges/page.tsx`)
    - List existing badges (standard + special)
    - Create special badge form: name, icon, description, condition
    - _Requirements: 8.4, 8.5_

  - [~] 14.6 Create admin banned terms page (`src/app/admin/arene/termes-interdits/page.tsx`)
    - List current terms with delete buttons
    - Add term form with validation (max 100 chars, max 500 total)
    - _Requirements: 10.9_

- [~] 15. Checkpoint — Frontend pages complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Badge system & Challenge completion logic
  - [~] 16.1 Implement badge awarding service (`src/lib/arene/badges.ts`)
    - Export `checkAndAwardBadges(memberId: string, action: ActionType, stats: MemberStats): Badge[]`
    - Check conditions: first_comment, first_vote, 10_battles, 50_reactions, 7_days_streak, challenge_complete, level_up
    - Insert into member_badges (idempotent via UNIQUE constraint)
    - Create notification on badge award
    - _Requirements: 8.1, 8.2, 8.6_

  - [ ]* 16.2 Write property tests for badge uniqueness
    - **Property 15: Badge uniqueness**
    - **Validates: Requirements 8.1**
    - File: `src/lib/arene/badges.test.ts`

  - [~] 16.3 Implement challenge completion tracker (`src/lib/arene/challenges.ts`)
    - Export `updateChallengeProgress(memberId: string, action: ActionType): ChallengeUpdate[]`
    - Increment progress, check if target reached, award points once
    - Respect single-completion constraint
    - _Requirements: 6.2, 6.6_

  - [ ]* 16.4 Write property tests for challenge single completion
    - **Property 11: Challenge single completion**
    - **Validates: Requirements 6.2, 6.6**
    - File: `src/lib/arene/challenges.test.ts`

- [ ] 17. Integration — Wire everything together
  - [~] 17.1 Integrate badge checking into API routes
    - After reactions, comments, and votes: call `checkAndAwardBadges`
    - After challenge completion: call `checkAndAwardBadges`
    - Ensure activity_feed entries are created for badge awards
    - _Requirements: 8.1, 9.1_

  - [~] 17.2 Integrate challenge progress into API routes
    - After reactions: update challenge progress for 'react_contents' challenges
    - After comments: update for 'comment_songs' challenges
    - After votes: update for 'vote_battles' challenges
    - _Requirements: 6.2_

  - [~] 17.3 Integrate Realtime subscriptions in frontend
    - BattleCard: subscribe to battle_votes changes for live progress bar
    - MurActivite: subscribe to activity_feed inserts
    - Ensure cleanup on navigation (AreneRealtimeManager.cleanup)
    - _Requirements: 13.1, 13.2, 13.5, 9.2_

  - [~] 17.4 Integrate leaderboard cache refresh
    - Trigger materialized view refresh after points changes (via database trigger or post-RPC)
    - Verify ISR revalidation tag works with Next.js
    - _Requirements: 13.4_

  - [~] 17.5 Add navigation link to Arène in site header
    - Add `/arene` link in desktop nav and mobile menu
    - Ensure existing header component is updated
    - _Requirements: 1.1_

  - [~] 17.6 Wire ecosystem integration
    - Activity feed: auto-create "Nouveau classement" entry when chart published
    - Discussions: allow opening threads linked to songs from chart pages
    - Battles: link to artist profiles from battle cards
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [~] 18. Checkpoint — Integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Integration and E2E tests
  - [ ]* 19.1 Write integration tests for API routes
    - Test full request lifecycle: auth → validation → DB → response
    - Cover: profile CRUD, reactions toggle, comments CRUD, votes, moderation flow
    - Use Supabase test client with test user
    - File: `src/app/api/arene/__tests__/integration.test.ts`
    - _Requirements: 15.1, 15.3, 15.6_

  - [ ]* 19.2 Write integration tests for Realtime propagation
    - Test: vote → realtime event → client receives update
    - Test: comment → activity feed entry → realtime notification
    - File: `src/app/api/arene/__tests__/realtime.test.ts`
    - _Requirements: 13.1, 13.5_

  - [ ]* 19.3 Write E2E tests with Playwright
    - Flow: login → navigate to /arene → react to content → verify points
    - Flow: login → vote in battle → verify progress bar updates
    - Flow: admin → create battle → verify appears on public page
    - Flow: report comment → verify auto-hide at 3 reports
    - File: `e2e/arene.spec.ts`
    - _Requirements: 1.1, 3.2, 5.3, 10.4_

  - [ ]* 19.4 Write accessibility tests
    - Keyboard navigation through all interactive elements
    - ARIA labels on reactions, votes, forms
    - Contrast ratio verification on cosmic backgrounds
    - Reduced motion: verify animations disabled
    - File: `e2e/arene-a11y.spec.ts`
    - _Requirements: 11.3, 11.4, 11.5, 11.6_

- [~] 20. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document (25 properties total)
- Unit tests validate specific examples and edge cases
- All API routes follow the existing project patterns: `createClient` for auth, `requireAdmin` for admin guards, Zod for validation
- Frontend components reuse existing cosmic visual components (StageLightsBackground, ShootingStars)
- Realtime subscriptions are managed centrally via AreneRealtimeManager (max 5 channels)
- French is the primary language for UI copy, error messages, and notifications

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.4", "3.1", "3.3", "3.6", "4.1", "4.3", "4.5", "4.7"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.5", "3.2", "3.4", "3.5", "3.7", "3.8", "4.2", "4.4", "4.6", "4.8"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.5", "6.7", "6.9", "6.11", "6.13", "9.1"] },
    { "id": 5, "tasks": ["6.3", "6.4", "6.6", "6.8", "6.10", "6.12", "6.14", "9.2"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3", "7.5", "7.6"] },
    { "id": 7, "tasks": ["7.4", "7.7", "7.8"] },
    { "id": 8, "tasks": ["10.1", "10.2", "10.3", "10.4"] },
    { "id": 9, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 10, "tasks": ["12.1", "12.2", "12.3", "12.4", "13.1", "13.2", "13.3", "13.4"] },
    { "id": 11, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6"] },
    { "id": 12, "tasks": ["16.1", "16.3"] },
    { "id": 13, "tasks": ["16.2", "16.4", "17.1", "17.2"] },
    { "id": 14, "tasks": ["17.3", "17.4", "17.5", "17.6"] },
    { "id": 15, "tasks": ["19.1", "19.2", "19.3", "19.4"] }
  ]
}
```
