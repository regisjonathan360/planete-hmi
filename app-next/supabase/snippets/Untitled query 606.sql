INSERT INTO tiktok_sounds (music_id, sound_title, sound_author, total_videos, total_views, total_likes, total_comments, total_shares, unique_creators, score, growth_7d, previous_total_videos, validation_status, first_seen_at)
VALUES
  ('snd_001', 'Kompa Love 2025', 'T-Vice', 850, 2500000, 180000, 12000, 45000, 320, 0.92, 45.50, 580, 'valide', now() - interval '3 days'),
  ('snd_002', 'Raboday Fire', 'Tony Mix', 620, 1800000, 95000, 8500, 32000, 210, 0.78, 120.30, 280, 'valide', now() - interval '5 days'),
  ('snd_003', 'Gouyad Dous', 'Kai', 1200, 4200000, 310000, 25000, 78000, 550, 0.95, 22.10, 980, 'valide', now() - interval '10 days'),
  ('snd_004', 'Ayiti Pam', 'Rutshelle Guillaume', 430, 980000, 65000, 5200, 18000, 180, 0.65, 85.70, 230, 'valide', now() - interval '2 days'),
  ('snd_005', 'Kanaval 2025 Anthem', 'Djakout #1', 2100, 6500000, 420000, 38000, 95000, 780, 0.98, 15.20, 1820, 'valide', now() - interval '20 days'),
  ('snd_006', 'New Vibe Haiti', 'Baky', 150, 320000, 22000, 1800, 5600, 85, 0.35, 9999.99, 0, 'a_verifier', now() - interval '1 day'),
  ('snd_007', 'Mizik Ayisyen', 'Harmonik', 280, 650000, 48000, 3200, 12000, 140, 0.52, 180.00, 100, 'a_verifier', now() - interval '4 days'),
  ('snd_008', 'Twoubadou Nights', 'BélO', 90, 180000, 15000, 900, 3200, 45, 0.28, 50.00, 60, 'a_verifier', now() - interval '6 days'),
  ('snd_009', 'Random Track FR', 'Artiste Français', 500, 1200000, 80000, 6000, 20000, 200, 0.70, 30.00, 380, 'refuse', now() - interval '15 days'),
  ('snd_010', 'Non Haitian Beat', 'DJ International', 300, 700000, 40000, 3000, 10000, 120, 0.45, 25.00, 240, 'refuse', now() - interval '12 days');
