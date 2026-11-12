-- V2: load answers in pages and summarise what a page only needs as totals.
-- Students used the site so much (65,000 answers in 4 days) that loading every answer at once
-- hit the database time limit. Now:
--   * v2_boot returns no raw answers, only daily achko totals for answers the page does not need one by one;
--   * v2_events_page returns the raw answers the page needs, 5,000 at a time, in the order they were saved.
-- Students: all of their own answers + classmates' "finished" markers; classmates' points as daily totals.
-- Teachers: every answer that belongs to a work (Results) + castle/trophy events; free practice as daily totals.

alter table public.v2_events add column if not exists seq bigint generated always as identity;
create unique index if not exists v2_events_seq on public.v2_events (seq);
create index if not exists v2_events_sid_seq on public.v2_events (sid, seq);

-- the achko an answer is worth (same rule as the page; teacher overrides are not applied to totals)
create or replace function public._v2_ach(k text, d jsonb) returns int
language sql immutable as $$
  select case
    when coalesce(d->>'ach', 'false') <> 'true' or coalesce(d->>'rapid', 'false') = 'true' then 0
    when k = 'ans' then coalesce((d->>'right')::int, 0) - coalesce((d->>'wrong')::int, 0)
    when k = 'game' then coalesce((d->>'achko')::int, 0)
    when coalesce(d->>'idk', 'false') = 'true' then -1
    when d->>'ok' = 'true' then 1
    when d->>'ok' = 'false' then -1
    else 0 end $$;

-- which answers a page gets one by one (the rest of the visible window is summed per day)
create or replace function public._v2_raw(tch boolean, me text, sid text, k text, d jsonb) returns boolean
language sql immutable as $$
  select case when tch then d ? 'work' or k in ('raid', 'sell', 'write')
              else sid = me or k in ('part', 'fin', 'att', 'secdone') end $$;

create or replace function public._v2_window(u public.users, me public.v2_person, out since bigint, out mates text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if u.role = 'teacher' then
    since := (extract(epoch from now() - interval '42 days') * 1000)::bigint; mates := null;
  else
    since := (extract(epoch from now() - interval '15 days') * 1000)::bigint;
    select array_agg(id) into mates from public.v2_person where cls = me.cls and not removed and id <> me.id;
  end if;
end $$;

create or replace function public.v2_boot(p_token text, p_days int default 42) returns json
language plpgsql security definer set search_path = public as $$
declare
  u public.users; me public.v2_person; tch boolean; adm boolean; w record; res json;
begin
  u := public._auth(p_token);
  me := public._v2_person(u);
  if me.removed then return json_build_object('error', 'REMOVED'); end if;
  tch := u.role = 'teacher'; adm := tch and u.is_admin;
  w := public._v2_window(u, me);

  select json_build_object(
    'me', json_build_object('id', me.id, 'role', u.role, 'admin', adm, 'name', public._v2_name(u), 'login', u.login),
    'now', (extract(epoch from now()) * 1000)::bigint,
    'since', case when tch then w.since end,
    'paged', true,
    'db', json_build_object(
      'v', 1,
      'settings', coalesce((select data from public.v2_doc where coll = 'settings' and id = 'main'), '{}'::jsonb),
      'groups', coalesce((select data from public.v2_doc where coll = 'groups' and id = 'list'), '[]'::jsonb),
      'teachers', coalesce((select json_agg(json_build_object('id', p.id, 'name', public._v2_name(x),
                    'login', case when tch then x.login else '' end, 'pass', '', 'admin', x.is_admin) order by x.id)
                    from public.v2_person p join public.users x on x.id = p.user_id
                    where x.role = 'teacher' and not p.removed), '[]'),
      'classes', coalesce((select json_agg(d.data order by d.data->>'name') from public.v2_doc d where d.coll = 'classes'), '[]'),
      'students', coalesce((select json_agg(json_build_object('id', p.id, 'name', public._v2_name(x),
                    'login', case when tch then x.login else '' end, 'pass', '', 'cls', p.cls, 'group', p.grp) order by x.first_name, x.last_name)
                    from public.v2_person p join public.users x on x.id = p.user_id
                    where x.role = 'student' and not p.removed and (tch or p.cls = me.cls)), '[]'),
      'works', coalesce((select json_agg(d.data order by d.data->>'sentAt') from public.v2_doc d where d.coll = 'works'
                    and (tch or coalesce(d.data->'groups', '[]'::jsonb) ? coalesce(me.grp, ''))), '[]'),
      'plans', case when tch then coalesce((select json_object_agg(d.id, d.data) from public.v2_doc d where d.coll = 'plans'), '{}') else '{}'::json end,
      'overrides', coalesce((select json_object_agg(d.id, d.data) from public.v2_doc d where d.coll = 'overrides'), '{}'),
      'accept', coalesce((select json_object_agg(d.id, d.data) from public.v2_doc d where d.coll = 'accept'), '{}'),
      'writings', coalesce((select json_agg(d.data order by d.updated_at) from public.v2_doc d where d.coll = 'writings' and (tch or d.sid = me.id)), '[]'),
      'reports', coalesce((select json_agg(d.data order by d.updated_at) from public.v2_doc d where d.coll = 'reports' and (tch or d.sid = me.id)), '[]'),
      'events', '[]'::json
    ),
    -- one total per person per Tashkent day for the answers that are not sent one by one
    'achsums', coalesce((select json_agg(json_build_object('id', 'as-' || sid || '-' || day, 'sid', sid, 'kind', 'achsum', 'ach', true, 'ts', day * 86400000::bigint - 18000000 + 1, 'n', n))
                 from (select e.sid, (e.ts + 18000000) / 86400000 as day, sum(public._v2_ach(e.kind, e.data)) n
                         from public.v2_events e
                        where e.ts >= w.since
                          and (tch or e.sid = any (w.mates))
                          and not public._v2_raw(tch, me.id, e.sid, e.kind, e.data)
                          and coalesce(e.data->>'ach', 'false') = 'true'
                        group by 1, 2) t where n <> 0), '[]'),
    'castles', coalesce((select json_object_agg(c.sid, c.state) from public.v2_castle c
                  where tch or c.sid in (select id from public.v2_person where cls = me.cls and not removed)), '{}')
  ) into res;
  return res;
end $$;

-- the raw answers a page needs, 5,000 at a time, after a cursor (seq); also used for the 2-minute refresh
create or replace function public.v2_events_page(p_token text, p_after bigint default 0, p_limit int default 5000) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; me public.v2_person; tch boolean; w record; lim int := least(greatest(coalesce(p_limit, 5000), 100), 10000); res json;
begin
  u := public._auth(p_token);
  me := public._v2_person(u);
  if me.removed then raise exception 'REMOVED'; end if;
  tch := u.role = 'teacher';
  w := public._v2_window(u, me);
  with page as (
    select e.seq, e.data from public.v2_events e
     where e.seq > coalesce(p_after, 0)
       and (case when tch then e.ts >= w.since and public._v2_raw(true, me.id, e.sid, e.kind, e.data)
                 else e.sid = me.id
                   or (e.sid = any (w.mates) and e.ts >= w.since and e.kind in ('part', 'fin', 'att', 'secdone')) end)
     order by e.seq limit lim)
  select json_build_object('events', coalesce(json_agg(data order by seq), '[]'), 'last', coalesce(max(seq), p_after), 'more', count(*) >= lim)
    into res from page;
  return res;
end $$;

revoke all on function public._v2_ach(text, jsonb), public._v2_raw(boolean, text, text, text, jsonb), public._v2_window(public.users, public.v2_person) from public, anon, authenticated;
revoke all on function public.v2_events_page(text, bigint, int) from public;
grant execute on function public.v2_events_page(text, bigint, int) to anon, authenticated;
