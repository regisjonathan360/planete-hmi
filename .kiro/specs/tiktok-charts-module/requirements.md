# Requirements Document

## Introduction

Module de classement TikTok pour Planète HMI. Ce module collecte des données de vidéos TikTok liées à la musique haïtienne, calcule un score de popularité par son, et produit trois classements distincts. Il s'intègre à l'architecture existante (chart_sources, chart_editions, chart_entries) et au panneau d'administration avec validation manuelle obligatoire avant publication.

## Glossary

- **TikTok_Collector**: Service serveur qui interroge l'API TikTok Research pour récupérer les vidéos pertinentes à la musique haïtienne.
- **TikTok_Score_Engine**: Module de calcul qui agrège les métriques des vidéos collectées pour produire un score par son musical.
- **Admin_Panel_TikTok**: Section d'administration accessible à /admin/tiktok permettant la validation et la publication des classements TikTok.
- **Chart_Source**: Enregistrement dans chart_sources identifiant une source de classement (platform = "tiktok").
- **Chart_Edition**: Édition hebdomadaire d'un classement, passant par le cycle draft → validated → published.
- **Chart_Entry**: Entrée individuelle dans une édition, représentant un son musical avec ses métriques.
- **Sound**: Un son TikTok identifié par son music_id, associé à un ou plusieurs artistes haïtiens.
- **Validation_Queue**: Zone "À valider" dans l'admin où les sons collectés attendent la confirmation de leur caractère haïtien.
- **TikTok_API**: API TikTok Research (open.tiktokapis.com/v2) utilisée pour la collecte de données vidéo.
- **Publications_Count**: Nombre de vidéos TikTok utilisant un son donné — métrique principale affichée, jamais présentée comme des streams.

## Requirements

### Requirement 1: TikTok API Authentication

**User Story:** As an administrator, I want the system to authenticate securely with TikTok's API, so that video data can be collected reliably.

#### Acceptance Criteria

1. THE TikTok_Collector SHALL authenticate with the TikTok_API using TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET environment variables stored server-side.
2. THE TikTok_Collector SHALL use TIKTOK_API_BASE_URL as the base endpoint, defaulting to https://open.tiktokapis.com/v2 when the variable is not set.
3. IF the TikTok_API returns an authentication error, THEN THE TikTok_Collector SHALL log the error with a descriptive message and halt the collection run without persisting partial data.
4. THE TikTok_Collector SHALL store credentials exclusively in server-side environment variables and never expose them to client-side code.

### Requirement 2: Video Data Collection

**User Story:** As an administrator, I want the system to collect TikTok videos related to Haitian music, so that trending sounds can be identified.

#### Acceptance Criteria

1. WHEN a collection is triggered, THE TikTok_Collector SHALL query the TikTok_API for videos matching region_code "HT".
2. WHEN a collection is triggered, THE TikTok_Collector SHALL query the TikTok_API for videos matching Haitian hashtags (including but not limited to: #haiti, #haitianmusic, #kompa, #raboday, #haitiantiktok).
3. WHEN a collection is triggered, THE TikTok_Collector SHALL query the TikTok_API for videos matching keywords related to Haitian music genres.
4. WHEN a collection is triggered, THE TikTok_Collector SHALL query the TikTok_API for videos mentioning artist names validated in the artists database table.
5. FOR EACH collected video, THE TikTok_Collector SHALL persist: video_id, music_id, username, create_time, region_code, view_count, like_count, comment_count, share_count, hashtag_names, and video_description.
6. THE TikTok_Collector SHALL deduplicate videos by video_id across collection runs, updating metrics for previously collected videos.

### Requirement 3: TikTok Score Calculation

**User Story:** As an administrator, I want a composite score calculated for each sound, so that sounds can be ranked objectively.

#### Acceptance Criteria

1. THE TikTok_Score_Engine SHALL compute a composite score per Sound using: the number of videos using the sound, total view count, total like count, total comment count, total share count, 7-day growth rate, and creator diversity (count of unique usernames).
2. THE TikTok_Score_Engine SHALL weight each score component according to configurable coefficients stored in the system.
3. WHEN scores are recalculated, THE TikTok_Score_Engine SHALL compute 7-day growth as the percentage change in total publications count compared to the value recorded 7 days prior.
4. THE TikTok_Score_Engine SHALL compute creator diversity as the count of distinct usernames who posted videos using a given Sound.
5. THE TikTok_Score_Engine SHALL recalculate scores each time a new collection completes successfully.

### Requirement 4: Admin Validation Workflow

**User Story:** As an administrator, I want to manually validate collected sounds before publication, so that only confirmed Haitian music appears in public charts.

#### Acceptance Criteria

1. WHEN a new Sound is collected for the first time, THE Admin_Panel_TikTok SHALL place it in the Validation_Queue with status "a_verifier".
2. THE Admin_Panel_TikTok SHALL display the Validation_Queue showing sound title, associated artist name, publications count, and score for each pending Sound.
3. WHEN an administrator sets a Sound's status to "valide", THE Admin_Panel_TikTok SHALL mark the Sound as eligible for chart inclusion.
4. WHEN an administrator sets a Sound's status to "refuse", THE Admin_Panel_TikTok SHALL exclude the Sound from all chart calculations permanently until manually reversed.
5. THE Admin_Panel_TikTok SHALL prevent automatic publication of any Sound without explicit administrator validation.
6. THE Admin_Panel_TikTok SHALL render its interface in French.

### Requirement 5: Three Chart Types

**User Story:** As a visitor, I want to see three distinct TikTok charts, so that I can discover trending Haitian music from different angles.

#### Acceptance Criteria

1. THE Chart_Source SHALL define three separate source keys for TikTok: "tiktok_haiti_global" (overall score ranking), "tiktok_haiti_en_montee" (fastest 7-day growth), and "tiktok_haiti_nouveautes" (new sounds within the last 14 days).
2. FOR the "Top TikTok Haiti Global" chart, THE TikTok_Score_Engine SHALL rank validated sounds by their composite score in descending order.
3. FOR the "Top TikTok Haiti En montée" chart, THE TikTok_Score_Engine SHALL rank validated sounds by their 7-day growth rate in descending order.
4. FOR the "Top TikTok Haiti Nouveautés" chart, THE TikTok_Score_Engine SHALL include only sounds first detected within the previous 14 days, ranked by composite score in descending order.
5. THE Chart_Source SHALL use metric_unit "posts_count" for all three TikTok chart types.
6. THE Admin_Panel_TikTok SHALL display the metric as "publications" in French UI and never present it as streams or views.

### Requirement 6: Platform-Agnostic Architecture Integration

**User Story:** As a developer, I want the TikTok module to follow the existing platform-agnostic architecture, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. THE TikTok_Collector SHALL store collected data using platform = "tiktok" in the platform_tracks table with external_id set to the TikTok music_id.
2. THE TikTok_Collector SHALL create Chart_Edition records linked to the appropriate Chart_Source for each collection cycle.
3. THE TikTok_Collector SHALL create Chart_Entry records within each edition, storing source_position derived from the score ranking and metric_value as the publications count.
4. THE Admin_Panel_TikTok SHALL follow the same draft → validate → publish workflow used by the existing Audiomack admin module.
5. THE Admin_Panel_TikTok SHALL reuse the existing recomputeAdminEdition, publishEdition, restoreLastPublished, and cancelChanges functions from the charts admin library.
6. THE Admin_Panel_TikTok SHALL use the existing auth guard (requireAdmin) for access control.

### Requirement 7: Admin Panel Interface

**User Story:** As an administrator, I want a dedicated TikTok admin section at /admin/tiktok, so that I can manage TikTok charts independently from other platforms.

#### Acceptance Criteria

1. THE Admin_Panel_TikTok SHALL be accessible at the route /admin/tiktok.
2. THE Admin_Panel_TikTok SHALL display a summary dashboard showing: total sounds collected, sounds pending validation, sounds validated, current edition status, and last collection timestamp.
3. WHEN an administrator triggers a collection, THE Admin_Panel_TikTok SHALL call the TikTok_Collector and display progress feedback.
4. THE Admin_Panel_TikTok SHALL provide entry management capabilities: reorder entries, hide entries, exclude entries with reason, and override display title/artist/artwork.
5. THE Admin_Panel_TikTok SHALL provide publish, restore last published, and cancel changes actions consistent with the existing admin pattern.
6. THE Admin_Panel_TikTok SHALL display the three chart types (Global, En montée, Nouveautés) as selectable tabs or sections.

### Requirement 8: Data Storage for TikTok Videos

**User Story:** As a developer, I want a dedicated table for raw TikTok video data, so that score calculations can be performed on historical data.

#### Acceptance Criteria

1. THE TikTok_Collector SHALL store raw video data in a tiktok_videos table containing: video_id (unique), music_id, username, create_time, region_code, view_count, like_count, comment_count, share_count, hashtag_names (array), video_description, and collected_at timestamp.
2. THE TikTok_Collector SHALL store aggregated sound data in a tiktok_sounds table containing: music_id (unique), sound_title, sound_author, total_videos, total_views, total_likes, total_comments, total_shares, unique_creators, score, growth_7d, first_seen_at, and last_updated_at.
3. WHEN a video is collected with a previously unseen music_id, THE TikTok_Collector SHALL create a new entry in tiktok_sounds and add it to the Validation_Queue.
4. THE tiktok_videos table SHALL enforce a unique constraint on video_id to prevent duplicate storage.
5. THE tiktok_sounds table SHALL enforce a unique constraint on music_id to prevent duplicate sound entries.

### Requirement 9: Collection Scheduling and Triggers

**User Story:** As an administrator, I want collections to run on a configurable schedule and on demand, so that chart data stays current.

#### Acceptance Criteria

1. THE TikTok_Collector SHALL support manual trigger via the Admin_Panel_TikTok collect button.
2. THE TikTok_Collector SHALL support automated scheduled collection via a cron-triggered API endpoint.
3. THE TikTok_Collector SHALL record each collection run in the sync_runs table with status, records received, records normalized, and error details if applicable.
4. IF a collection run fails mid-execution, THEN THE TikTok_Collector SHALL record the failure in sync_runs and not overwrite previously valid data.

### Requirement 10: HMI Shorts Homepage Connection

**User Story:** As a visitor, I want to see trending TikTok videos on the homepage "HMI Shorts" section, so that I can discover viral Haitian content directly.

#### Acceptance Criteria

1. THE Admin_Panel_TikTok SHALL allow administrators to select featured videos from collected TikTok data for the "HMI Shorts" homepage section.
2. WHEN videos are selected for HMI Shorts, THE system SHALL display them with video_id, thumbnail, sound title, and creator username.
3. THE system SHALL display a maximum of 10 featured videos in the HMI Shorts section at any given time.
4. THE system SHALL only display HMI Shorts videos associated with validated (status "valide") sounds.

### Requirement 11: Security and Data Privacy

**User Story:** As a platform owner, I want all TikTok API interactions to be secure, so that credentials are protected and data access is controlled.

#### Acceptance Criteria

1. THE TikTok_Collector SHALL execute exclusively on the server side (API routes or server actions) and never in client-side JavaScript.
2. THE system SHALL enforce Row Level Security (RLS) on tiktok_videos and tiktok_sounds tables, restricting write access to the service role.
3. THE system SHALL allow public read access to published chart snapshots only through the chart_published_snapshots table.
4. IF a TikTok_API request fails due to rate limiting, THEN THE TikTok_Collector SHALL implement exponential backoff and retry up to 3 times before marking the run as failed.
