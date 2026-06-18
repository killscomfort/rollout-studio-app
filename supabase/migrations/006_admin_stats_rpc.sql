-- Admin dashboard RPC (authenticated admins only)

create or replace function public.admin_user_summary()
returns table (
  email text,
  last_platform text,
  last_seen_at timestamptz,
  profile_created timestamptz,
  projects bigint,
  tasks_completed bigint,
  events_7d bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
begin
  caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if caller_email <> 'killscomfort@gmail.com' then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.email,
    p.last_platform,
    p.last_seen_at,
    p.created_at as profile_created,
    count(distinct pr.id) as projects,
    count(distinct tp.task_id) as tasks_completed,
    count(distinct ue.id) filter (where ue.created_at > now() - interval '7 days') as events_7d
  from public.profiles p
  left join public.projects pr on pr.user_id = p.id
  left join public.task_progress tp on tp.user_id = p.id
  left join public.user_events ue on ue.user_id = p.id
  group by p.id, p.email, p.last_platform, p.last_seen_at, p.created_at
  order by p.last_seen_at desc
  limit 50;
end;
$$;

create or replace function public.admin_event_summary()
returns table (
  event text,
  total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
begin
  caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if caller_email <> 'killscomfort@gmail.com' then
    raise exception 'not authorized';
  end if;

  return query
  select ue.event, count(*)::bigint as total
  from public.user_events ue
  where ue.created_at > now() - interval '30 days'
  group by ue.event
  order by total desc;
end;
$$;

grant execute on function public.admin_user_summary() to authenticated;
grant execute on function public.admin_event_summary() to authenticated;
