-- Migration pour la synchronisation YouTube → Radio
-- Fonction RPC pour synchroniser automatiquement

-- Fonction pour synchroniser les vidéos YouTube vers radio_tracks
CREATE OR REPLACE FUNCTION sync_youtube_to_radio(p_video_types text[] DEFAULT NULL)
RETURNS TABLE (
  synced_count integer,
  updated_count integer,
  total_count integer
) AS $$
DECLARE
  v_synced integer := 0;
  v_updated integer := 0;
  v_total integer := 0;
BEGIN
  -- Si aucun type spécifié, utiliser les types musicaux par défaut
  IF p_video_types IS NULL THEN
    p_video_types := ARRAY[
      'OFFICIAL_MUSIC_VIDEO',
      'OFFICIAL_AUDIO',
      'OFFICIAL_LYRIC_VIDEO',
      'OFFICIAL_VISUALIZER',
      'SHORT'
    ];
  END IF;

  -- Insérer ou mettre à jour les pistes
  WITH upserted AS (
    INSERT INTO radio_tracks (
      id,
      title,
      artist_name,
      artist_id,
      audio_url,
      cover_image_url,
      duration_seconds,
      source,
      source_id,
      is_active,
      created_at,
      updated_at
    )
    SELECT 
      yv.id,
      COALESCE(yv.display_title, yv.source_title),
      COALESCE(a.name, yc.channel_name, 'Artiste inconnu'),
      t.artist_id,
      'https://www.youtube.com/watch?v=' || yv.video_id,
      COALESCE(yv.display_thumbnail_url, yv.source_thumbnail_url),
      COALESCE(yv.duration_seconds, 180),
      'youtube',
      yv.video_id,
      yv.is_active,
      yv.created_at,
      NOW()
    FROM youtube_videos yv
    JOIN youtube_channels yc ON yc.channel_id = yv.channel_id
    LEFT JOIN tracks t ON t.id = yv.track_id
    LEFT JOIN artists a ON a.id = t.artist_id
    WHERE yv.review_status = 'APPROVED'
      AND yv.is_eligible = true
      AND yv.is_active = true
      AND yv.video_type = ANY(p_video_types)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      artist_name = EXCLUDED.artist_name,
      artist_id = EXCLUDED.artist_id,
      cover_image_url = EXCLUDED.cover_image_url,
      duration_seconds = EXCLUDED.duration_seconds,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING 
      CASE WHEN xmax = 0 THEN 1 ELSE 0 END as is_insert,
      CASE WHEN xmax != 0 THEN 1 ELSE 0 END as is_update
  )
  SELECT 
    SUM(is_insert)::integer,
    SUM(is_update)::integer,
    COUNT(*)::integer
  INTO v_synced, v_updated, v_total
  FROM upserted;

  RETURN QUERY SELECT 
    COALESCE(v_synced, 0),
    COALESCE(v_updated, 0),
    COALESCE(v_total, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_youtube_to_radio IS 
'Synchronise les vidéos YouTube approuvées et éligibles vers radio_tracks';

-- Fonction pour récupérer les pistes d''un classement pour la radio
CREATE OR REPLACE FUNCTION get_chart_radio_tracks(chart_key text)
RETURNS TABLE (
  track_id uuid,
  track_title text,
  artist_name text,
  audio_url text,
  cover_image_url text,
  duration_seconds integer,
  chart_position integer
) AS $$
BEGIN
  -- Pour l'instant, retourne les pistes YouTube triées par vues
  -- À adapter selon votre structure de classements
  RETURN QUERY
  SELECT 
    rt.id as track_id,
    rt.title as track_title,
    rt.artist_name,
    rt.audio_url,
    rt.cover_image_url,
    rt.duration_seconds,
    ROW_NUMBER() OVER (ORDER BY yv.view_count DESC)::integer as chart_position
  FROM radio_tracks rt
  JOIN youtube_videos yv ON yv.id = rt.id
  WHERE rt.source = 'youtube'
    AND rt.is_active = true
    AND yv.review_status = 'APPROVED'
    AND yv.is_eligible = true
  ORDER BY yv.view_count DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_chart_radio_tracks IS 
'Récupère les pistes d''un classement pour la radio';
