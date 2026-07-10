-- Étape 1 : Récupérer les IDs des chart_sources TikTok
-- Étape 2 : Créer des éditions draft
-- Étape 3 : Insérer les entrées de classement

DO $$
DECLARE
  v_global_source_id uuid;
  v_montee_source_id uuid;
  v_nouveautes_source_id uuid;
  v_global_edition_id uuid;
  v_montee_edition_id uuid;
  v_nouveautes_edition_id uuid;
  v_sound RECORD;
  v_position integer;
BEGIN
  -- Récupérer les source IDs
  SELECT id INTO v_global_source_id FROM chart_sources WHERE source_key = 'tiktok_haiti_global';
  SELECT id INTO v_montee_source_id FROM chart_sources WHERE source_key = 'tiktok_haiti_en_montee';
  SELECT id INTO v_nouveautes_source_id FROM chart_sources WHERE source_key = 'tiktok_haiti_nouveautes';

  -- Créer l'édition Global (draft)
  INSERT INTO chart_editions (chart_source_id, edition_key, period_start, period_end, collected_at, status, is_stale, entry_count)
  VALUES (v_global_source_id, 'tiktok-global-' || to_char(now(), 'YYYY-MM-DD'), now() - interval '7 days', now(), now(), 'draft', false, 0)
  RETURNING id INTO v_global_edition_id;

  -- Créer l'édition En montée (draft)
  INSERT INTO chart_editions (chart_source_id, edition_key, period_start, period_end, collected_at, status, is_stale, entry_count)
  VALUES (v_montee_source_id, 'tiktok-montee-' || to_char(now(), 'YYYY-MM-DD'), now() - interval '7 days', now(), now(), 'draft', false, 0)
  RETURNING id INTO v_montee_edition_id;

  -- Créer l'édition Nouveautés (draft)
  INSERT INTO chart_editions (chart_source_id, edition_key, period_start, period_end, collected_at, status, is_stale, entry_count)
  VALUES (v_nouveautes_source_id, 'tiktok-nouveautes-' || to_char(now(), 'YYYY-MM-DD'), now() - interval '7 days', now(), now(), 'draft', false, 0)
  RETURNING id INTO v_nouveautes_edition_id;

  -- Insérer les entrées GLOBAL (triées par score desc)
  v_position := 0;
  FOR v_sound IN
    SELECT music_id, sound_title, sound_author, total_videos, score
    FROM tiktok_sounds
    WHERE validation_status = 'valide'
    ORDER BY score DESC
  LOOP
    v_position := v_position + 1;
    INSERT INTO chart_entries (chart_edition_id, source_position, raw_track_title, raw_artist_text, metric_value, metric_unit)
    VALUES (v_global_edition_id, v_position, v_sound.sound_title, v_sound.sound_author, v_sound.total_videos, 'posts_count');
  END LOOP;
  UPDATE chart_editions SET entry_count = v_position WHERE id = v_global_edition_id;

  -- Insérer les entrées EN MONTÉE (triées par growth_7d desc)
  v_position := 0;
  FOR v_sound IN
    SELECT music_id, sound_title, sound_author, total_videos, growth_7d
    FROM tiktok_sounds
    WHERE validation_status = 'valide'
    ORDER BY growth_7d DESC
  LOOP
    v_position := v_position + 1;
    INSERT INTO chart_entries (chart_edition_id, source_position, raw_track_title, raw_artist_text, metric_value, metric_unit)
    VALUES (v_montee_edition_id, v_position, v_sound.sound_title, v_sound.sound_author, v_sound.total_videos, 'posts_count');
  END LOOP;
  UPDATE chart_editions SET entry_count = v_position WHERE id = v_montee_edition_id;

  -- Insérer les entrées NOUVEAUTÉS (sons des 14 derniers jours, triés par score)
  v_position := 0;
  FOR v_sound IN
    SELECT music_id, sound_title, sound_author, total_videos, score
    FROM tiktok_sounds
    WHERE validation_status = 'valide' AND first_seen_at >= now() - interval '14 days'
    ORDER BY score DESC
  LOOP
    v_position := v_position + 1;
    INSERT INTO chart_entries (chart_edition_id, source_position, raw_track_title, raw_artist_text, metric_value, metric_unit)
    VALUES (v_nouveautes_edition_id, v_position, v_sound.sound_title, v_sound.sound_author, v_sound.total_videos, 'posts_count');
  END LOOP;
  UPDATE chart_editions SET entry_count = v_position WHERE id = v_nouveautes_edition_id;

  RAISE NOTICE 'Éditions créées : Global=%, Montée=%, Nouveautés=%', v_global_edition_id, v_montee_edition_id, v_nouveautes_edition_id;
END;
$$;
