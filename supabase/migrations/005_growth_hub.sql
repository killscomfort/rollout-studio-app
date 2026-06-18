-- Growth hub: playlist/label trackers + social post analytics (per project)

alter table public.projects
  add column if not exists growth_data jsonb not null default '{
    "playlistSubmissions": [],
    "labelSubmissions": [],
    "socialPosts": []
  }'::jsonb;
