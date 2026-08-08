create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  idempotency_key uuid not null unique,
  provider text not null,
  payment_mode text not null,
  provider_transaction_id text,
  amount numeric(12, 2) not null,
  currency text not null,
  status text not null default 'PENDING',
  donor_name text,
  donor_email text,
  donor_phone text,
  donor_message text,
  is_anonymous boolean not null default false,
  manual_transaction_code text,
  proof_storage_path text,
  provider_payload jsonb,
  internal_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contributions_reference_format check (
    reference ~ '^HMI-[A-Z0-9]{6}-[A-Z0-9]{10}$'
  ),
  constraint contributions_provider_check check (
    provider in (
      'moncash',
      'natcash',
      'paypal',
      'mannitoks',
      'remitly',
      'western_union',
      'taptap_send',
      'other'
    )
  ),
  constraint contributions_payment_mode_check check (
    payment_mode in ('AUTOMATIC', 'MANUAL', 'EXTERNAL_REDIRECT')
  ),
  constraint contributions_amount_check check (
    amount > 0 and amount <= 1000000
  ),
  constraint contributions_currency_check check (
    currency in ('HTG', 'USD')
  ),
  constraint contributions_status_check check (
    status in (
      'DRAFT',
      'PENDING',
      'PENDING_REVIEW',
      'PROCESSING',
      'CONFIRMED',
      'REJECTED',
      'FAILED',
      'CANCELLED',
      'REFUNDED'
    )
  ),
  constraint contributions_donor_name_length check (
    donor_name is null or char_length(donor_name) <= 120
  ),
  constraint contributions_donor_email_length check (
    donor_email is null or char_length(donor_email) <= 254
  ),
  constraint contributions_donor_phone_length check (
    donor_phone is null or char_length(donor_phone) <= 40
  ),
  constraint contributions_message_length check (
    donor_message is null or char_length(donor_message) <= 1000
  ),
  constraint contributions_transaction_code_length check (
    manual_transaction_code is null or char_length(manual_transaction_code) <= 160
  )
);

create index contributions_created_at_idx
  on public.contributions (created_at desc);
create index contributions_status_created_at_idx
  on public.contributions (status, created_at desc);
create index contributions_provider_created_at_idx
  on public.contributions (provider, created_at desc);
create index contributions_currency_created_at_idx
  on public.contributions (currency, created_at desc);
create unique index contributions_provider_transaction_unique_idx
  on public.contributions (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create unique index contributions_manual_transaction_unique_idx
  on public.contributions (provider, manual_transaction_code)
  where manual_transaction_code is not null;

create trigger contributions_set_updated_at
  before update on public.contributions
  for each row execute function public.set_updated_at();

create table public.contribution_status_history (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null
    references public.contributions(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint contribution_history_previous_status_check check (
    previous_status is null or previous_status in (
      'DRAFT',
      'PENDING',
      'PENDING_REVIEW',
      'PROCESSING',
      'CONFIRMED',
      'REJECTED',
      'FAILED',
      'CANCELLED',
      'REFUNDED'
    )
  ),
  constraint contribution_history_new_status_check check (
    new_status in (
      'DRAFT',
      'PENDING',
      'PENDING_REVIEW',
      'PROCESSING',
      'CONFIRMED',
      'REJECTED',
      'FAILED',
      'CANCELLED',
      'REFUNDED'
    )
  ),
  constraint contribution_history_reason_length check (
    reason is null or char_length(reason) <= 2000
  )
);

create index contribution_status_history_contribution_idx
  on public.contribution_status_history (contribution_id, created_at desc);

create table public.contribution_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint contribution_rate_limits_key_check check (
    key_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint contribution_rate_limits_count_check check (
    request_count >= 0
  )
);

create trigger contribution_rate_limits_set_updated_at
  before update on public.contribution_rate_limits
  for each row execute function public.set_updated_at();

create or replace function public.consume_contribution_rate_limit(
  p_key_hash text,
  p_limit integer default 8,
  p_window_seconds integer default 3600
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_count integer;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1
     or p_limit > 100
     or p_window_seconds < 60
     or p_window_seconds > 86400 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('contribution-rate:' || p_key_hash));

  insert into public.contribution_rate_limits (
    key_hash,
    window_started_at,
    request_count
  )
  values (p_key_hash, clock_timestamp(), 1)
  on conflict (key_hash) do update
  set
    window_started_at = case
      when public.contribution_rate_limits.window_started_at
        <= clock_timestamp() - make_interval(secs => p_window_seconds)
      then clock_timestamp()
      else public.contribution_rate_limits.window_started_at
    end,
    request_count = case
      when public.contribution_rate_limits.window_started_at
        <= clock_timestamp() - make_interval(secs => p_window_seconds)
      then 1
      else public.contribution_rate_limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

create or replace function public.review_contribution(
  p_contribution_id uuid,
  p_new_status text,
  p_changed_by uuid,
  p_reason text default null,
  p_internal_notes text default null
)
returns public.contributions
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_row public.contributions;
  updated_row public.contributions;
begin
  if p_new_status not in ('CONFIRMED', 'REJECTED', 'PENDING_REVIEW') then
    raise exception 'invalid_status';
  end if;

  select *
  into current_row
  from public.contributions
  where id = p_contribution_id
  for update;

  if not found then
    raise exception 'contribution_not_found';
  end if;

  if current_row.status in ('REFUNDED', 'CANCELLED') then
    raise exception 'status_transition_not_allowed';
  end if;

  update public.contributions
  set
    status = p_new_status,
    reviewed_by = p_changed_by,
    reviewed_at = clock_timestamp(),
    internal_notes = nullif(trim(p_internal_notes), '')
  where id = p_contribution_id
  returning * into updated_row;

  insert into public.contribution_status_history (
    contribution_id,
    previous_status,
    new_status,
    changed_by,
    reason
  )
  values (
    p_contribution_id,
    current_row.status,
    p_new_status,
    p_changed_by,
    nullif(trim(p_reason), '')
  );

  return updated_row;
end;
$$;

alter table public.contributions enable row level security;
alter table public.contribution_status_history enable row level security;
alter table public.contribution_rate_limits enable row level security;

create policy "admins_manage_contributions"
  on public.contributions
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "admins_read_contribution_history"
  on public.contribution_status_history
  for select
  to authenticated
  using ((select public.is_admin()));

revoke all on table public.contributions from public, anon, authenticated;
revoke all on table public.contribution_status_history from public, anon, authenticated;
revoke all on table public.contribution_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.contributions to service_role;
grant select, insert on table public.contribution_status_history to service_role;
grant select, insert, update, delete on table public.contribution_rate_limits to service_role;

revoke all on function public.consume_contribution_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_contribution_rate_limit(text, integer, integer)
  to service_role;

revoke all on function public.review_contribution(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_contribution(uuid, text, uuid, text, text)
  to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'contribution-proofs',
  'contribution-proofs',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.contributions is
  'Contributions volontaires à Planète HMI. Les visiteurs passent exclusivement par les routes serveur.';
comment on column public.contributions.provider_payload is
  'Réponse fournisseur minimale et nettoyée. Ne doit contenir aucun secret.';
comment on column public.contributions.proof_storage_path is
  'Chemin privé dans le bucket contribution-proofs.';
