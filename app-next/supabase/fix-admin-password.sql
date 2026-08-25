-- Réinitialiser le mot de passe admin avec un hash bcrypt pré-calculé (cost 10).
-- Aucun mot de passe en clair dans ce dépôt : le mot de passe réel vit dans un
-- gestionnaire de mots de passe. Remplacer le hash ci-dessous après régénération.
UPDATE auth.users
SET encrypted_password = '$2a$10$CYxwun1..FfatGDMMIzEiOwCjTMork3h400EB9BdB1xzb6d1uz1N.'
WHERE email = 'admin@planete-hmi.local';
