alter table public.projects
  add column if not exists notification_schedule jsonb;
