-- Créer un utilisateur admin de développement local.
-- Identifiants : admin@planete-hmi.local / Admin123!

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
  crypt('Admin123!', gen_salt('bf')),
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
