-- Autoriser les utilisateurs authentifiés à lire user_roles (la RLS filtre ensuite).
GRANT SELECT ON public.user_roles TO authenticated;
