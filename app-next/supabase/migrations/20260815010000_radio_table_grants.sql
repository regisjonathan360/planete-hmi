-- =========================================================
-- Radio : grants d'accès aux tables
-- Nécessaire car les migrations radio n'ont jamais émis de
-- GRANT : service_role, anon et authenticated n'ont aucun
-- privilège sur les tables radio (permission denied).
-- En production, ces grants ont été ajoutés manuellement
-- dans le SQL editor ; cette migration les rend reproductibles.
-- =========================================================

grant select, insert, update, delete on table public.radio_playlists to service_role;
grant select, insert, update, delete on table public.radio_tracks to service_role;
grant select, insert, update, delete on table public.radio_playlist_tracks to service_role;
grant select, insert, update, delete on table public.radio_config to service_role;
grant select, insert, update, delete on table public.radio_play_history to service_role;
grant select, insert, update, delete on table public.radio_stats to service_role;

grant select on table public.radio_playlists to anon, authenticated;
grant select on table public.radio_tracks to anon, authenticated;
grant select on table public.radio_playlist_tracks to anon, authenticated;
grant select on table public.radio_config to anon, authenticated;

-- user_roles : le guard admin (requireAdmin/getAdminUser) lit le rôle avec la
-- session utilisateur. La migration d'origine ne donnait aucun grant public
-- (accès service uniquement) ; ajout manuel requis en prod pour que l'admin
-- puisse se connecter. La policy "admin manage user_roles" filtre ensuite
-- les lignes (is_admin()).
grant select on table public.user_roles to authenticated;