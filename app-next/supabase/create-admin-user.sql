-- Créer un utilisateur admin de développement local.
-- Identifiant : admin@planete-hmi.local
-- Le mot de passe n'est JAMAIS stocké en clair ici : seul le hash bcrypt est
-- présent dans ce dépôt. Le mot de passe réel est conservé dans un gestionnaire
-- de mots de passe et doit être appliqué manuellement sur l'instance cible.
-- Pour régénérer un hash : bcrypt (cost >= 10), ex. via bcryptjs :
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" '<mot-de-passe>'

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, confirmation_token,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@planete-hmi.local',
  '$2a$10$CYxwun1..FfatGDMMIzEiOwCjTMork3h400EB9BdB1xzb6d1uz1N.',
  now(), now(), now(), '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin HMI"}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"admin@planete-hmi.local"}',
  'email',
  'aaaaaaaa-0000-0000-0000-000000000001',
  now(), now(), now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
