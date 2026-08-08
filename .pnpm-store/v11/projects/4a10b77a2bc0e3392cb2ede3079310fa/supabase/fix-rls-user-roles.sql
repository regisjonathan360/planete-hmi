-- Permettre à un utilisateur authentifié de lire sa propre ligne dans user_roles.
-- Sans cela, is_admin() ne peut pas fonctionner via le client anon/session.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'users read own role'
  ) THEN
    CREATE POLICY "users read own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;
