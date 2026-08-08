-- Corriger les images manquantes pour les artistes trouvables sur Audiomack.
UPDATE artists SET image_url = 'https://i.audiomack.com/joe-dwet-file/9fc95f2039.webp?width=1200' WHERE lower(name) = 'joé dwèt filé';
UPDATE artists SET image_url = 'https://i.audiomack.com/diplo/b4f72380d4.webp?width=1200' WHERE lower(name) = 'diplo';
UPDATE artists SET image_url = 'https://i.audiomack.com/sarkodie/193235d302.webp?width=1200' WHERE lower(name) = 'sarkodie';
UPDATE artists SET image_url = 'https://i.audiomack.com/oklotrue/e4377464a2.webp?width=1200' WHERE lower(name) = 'oklo true';
-- Bedjine et Mebel Brun n'ont pas de photo de profil sur Audiomack (image générique).
