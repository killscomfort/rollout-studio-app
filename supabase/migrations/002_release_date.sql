alter table public.projects
  add column if not exists release_date date;
