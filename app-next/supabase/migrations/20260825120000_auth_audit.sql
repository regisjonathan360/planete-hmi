-- Journal d'audit des événements d'authentification côté application.
-- Chaque utilisateur ne peut insérer/lire que ses propres lignes.
create table if not exists public.auth_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_audit_user_idx on public.auth_audit (user_id, created_at desc);

alter table public.auth_audit enable row level security;

drop policy if exists "users insert own audit" on public.auth_audit;
create policy "users insert own audit" on public.auth_audit
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users read own audit" on public.auth_audit;
create policy "users read own audit" on public.auth_audit
  for select to authenticated
  using (auth.uid() = user_id);

grant select, insert on public.auth_audit to authenticated;

-- Lecture complète réservée aux admins (modération / sécurité).
drop policy if exists "admin read all audit" on public.auth_audit;
create policy "admin read all audit" on public.auth_audit
  for select to authenticated
  using (public.is_admin());
