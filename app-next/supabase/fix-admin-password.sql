-- Réinitialiser le mot de passe admin avec un hash bcrypt connu.
-- Mot de passe : Admin123!
-- Hash bcrypt pré-calculé (cost 10) :
UPDATE auth.users
SET encrypted_password = '$2a$10$PwGnRskyC6dOFGDqkOCn4e4hF.9uDmnfGbEXjW5V5FqW0xDOVLVTe'
WHERE email = 'admin@planete-hmi.local';
