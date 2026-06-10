-- Rollout Studio cloud schema
-- Run in Supabase SQL Editor or via `supabase db push`

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  name text not null,
  tagline text not null default '',
  booking_url text not null default '',
  funnel_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sort_order integer not null,
  title text not null,
  color text not null
);

create table if not exists public.weeks (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  sort_order integer not null,
  label text not null,
  subtitle text not null default ''
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  sort_order integer not null,
  day text not null,
  category text not null,
  task text not null
);

create table if not exists public.task_progress (
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (project_id, task_id)
);

create index if not exists phases_project_id_idx on public.phases (project_id);
create index if not exists weeks_phase_id_idx on public.weeks (phase_id);
create index if not exists tasks_week_id_idx on public.tasks (week_id);
create index if not exists task_progress_user_id_idx on public.task_progress (user_id);

alter table public.projects enable row level security;
alter table public.phases enable row level security;
alter table public.weeks enable row level security;
alter table public.tasks enable row level security;
alter table public.task_progress enable row level security;

create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

create policy "phases_select_own"
  on public.phases for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = phases.project_id and p.user_id = auth.uid()
    )
  );

create policy "phases_insert_own"
  on public.phases for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = phases.project_id and p.user_id = auth.uid()
    )
  );

create policy "phases_update_own"
  on public.phases for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = phases.project_id and p.user_id = auth.uid()
    )
  );

create policy "phases_delete_own"
  on public.phases for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = phases.project_id and p.user_id = auth.uid()
    )
  );

create policy "weeks_select_own"
  on public.weeks for select
  using (
    exists (
      select 1
      from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = weeks.phase_id and p.user_id = auth.uid()
    )
  );

create policy "weeks_insert_own"
  on public.weeks for insert
  with check (
    exists (
      select 1
      from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = weeks.phase_id and p.user_id = auth.uid()
    )
  );

create policy "weeks_update_own"
  on public.weeks for update
  using (
    exists (
      select 1
      from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = weeks.phase_id and p.user_id = auth.uid()
    )
  );

create policy "weeks_delete_own"
  on public.weeks for delete
  using (
    exists (
      select 1
      from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = weeks.phase_id and p.user_id = auth.uid()
    )
  );

create policy "tasks_select_own"
  on public.tasks for select
  using (
    exists (
      select 1
      from public.weeks w
      join public.phases ph on ph.id = w.phase_id
      join public.projects p on p.id = ph.project_id
      where w.id = tasks.week_id and p.user_id = auth.uid()
    )
  );

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (
    exists (
      select 1
      from public.weeks w
      join public.phases ph on ph.id = w.phase_id
      join public.projects p on p.id = ph.project_id
      where w.id = tasks.week_id and p.user_id = auth.uid()
    )
  );

create policy "tasks_update_own"
  on public.tasks for update
  using (
    exists (
      select 1
      from public.weeks w
      join public.phases ph on ph.id = w.phase_id
      join public.projects p on p.id = ph.project_id
      where w.id = tasks.week_id and p.user_id = auth.uid()
    )
  );

create policy "tasks_delete_own"
  on public.tasks for delete
  using (
    exists (
      select 1
      from public.weeks w
      join public.phases ph on ph.id = w.phase_id
      join public.projects p on p.id = ph.project_id
      where w.id = tasks.week_id and p.user_id = auth.uid()
    )
  );

create policy "task_progress_select_own"
  on public.task_progress for select
  using (auth.uid() = user_id);

create policy "task_progress_insert_own"
  on public.task_progress for insert
  with check (auth.uid() = user_id);

create policy "task_progress_update_own"
  on public.task_progress for update
  using (auth.uid() = user_id);

create policy "task_progress_delete_own"
  on public.task_progress for delete
  using (auth.uid() = user_id);
