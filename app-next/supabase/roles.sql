-- Placeholder globals applied BEFORE migrations (roles.sql).
-- is_admin() est recrée par 20260706173846_create_charts_rls.sql,
-- mais les migrations antérieures (000003_arene_rls_policies) l'utilisent déjà.
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v boolean;
begin
  if not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public' and tablename = 'user_roles'
  ) then
    return false;
  end if;
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  ) into v;
  return v;
end;
$$;