-- User presence + product event tracking (cloud mode)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_platform text not null default 'unknown',
  app_version text not null default ''
);

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null,
  properties jsonb not null default '{}'::jsonb,
  platform text not null default 'unknown',
  created_at timestamptz not null default now()
);

create index if not exists profiles_last_seen_at_idx on public.profiles (last_seen_at desc);
create index if not exists user_events_user_id_created_at_idx
  on public.user_events (user_id, created_at desc);
create index if not exists user_events_event_created_at_idx
  on public.user_events (event, created_at desc);

alter table public.profiles enable row level security;
alter table public.user_events enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "user_events_select_own"
  on public.user_events for select
  using (auth.uid() = user_id);

create policy "user_events_insert_own"
  on public.user_events for insert
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();
