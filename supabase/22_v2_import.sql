-- One-time import of the old site's people, classes, timetable, gold and learned words into V2.
-- Reads the old tables only; writes only v2_* tables. Safe to run once (later runs skip what exists).

begin;

-- 1. people: every account gets its V2 person (students keep their class and level group)
insert into public.v2_person (id, user_id, cls, grp)
select case when u.role = 'teacher' then 't' else 'u' end || u.id, u.id,
       case when u.role = 'student' and u.class_id is not null then 'c' || u.class_id end,
       case when u.role = 'student' then p.name end
from public.users u left join public.pools p on p.id = u.pool_id
on conflict do nothing;

-- 2. groups = the old level groups (pools)
insert into public.v2_doc (coll, id, data)
select 'groups', 'list', coalesce(jsonb_agg(name order by id), '[]') from public.pools
on conflict do nothing;

-- 3. classes with their timetable (Mon..Sat, "HH:MM" pairs)
with d(dow, k) as (values (1,'Mon'),(2,'Tue'),(3,'Wed'),(4,'Thu'),(5,'Fri'),(6,'Sat')),
slots as (
  select c.id, d.k,
         coalesce((select jsonb_agg(jsonb_build_array(
                     to_char(make_time(t.start_min / 60, t.start_min % 60, 0), 'HH24:MI'),
                     to_char(make_time(least(t.end_min, 1439) / 60, least(t.end_min, 1439) % 60, 0), 'HH24:MI')) order by t.start_min)
                   from public.timetable t where t.class_id = c.id and t.dow = d.dow), '[]') l
  from public.classes c cross join d
)
insert into public.v2_doc (coll, id, data)
select 'classes', 'c' || c.id, jsonb_build_object(
  'id', 'c' || c.id, 'name', c.name, 'teacher', 't' || coalesce(c.teacher_id, (select min(id) from public.users where role = 'teacher' and is_admin)),
  'taught', '', 'sched', (select jsonb_object_agg(s.k, s.l) from slots s where s.id = c.id))
from public.classes c
on conflict do nothing;

-- 4. settings
insert into public.v2_doc (coll, id, data)
values ('settings', 'main', jsonb_build_object('nextW', 100, 'created', (extract(epoch from now()) * 1000)::bigint))
on conflict do nothing;

-- 5. castles: a fresh V2 castle holding the gold each student had in the old game (storage cap 1000)
insert into public.v2_castle (sid, state)
select 'u' || u.id, jsonb_build_object(
  'gold', least(1000, greatest(0, coalesce(g.gold, 0))), 'cr', 0,
  'b', '{"castle":1,"wall":1,"tower":1,"barracks":1,"storage":1}'::jsonb,
  'fund', '{"castle":0,"wall":0,"tower":0,"barracks":0,"storage":0}'::jsonb,
  'jobs', '[]'::jsonb, 'wait', '[]'::jsonb, 'builders', 1,
  'tr', '{"sword":{"lv":1,"fund":0},"archer":{"lv":1,"fund":0},"brute":{"lv":1,"fund":0},"bird":{"lv":1,"fund":0},"giant":{"lv":1,"fund":0}}'::jsonb,
  'tjob', null, 'twait', '[]'::jsonb,
  'army', '{"sword":6,"archer":2,"brute":0,"bird":0,"giant":0}'::jsonb,
  'att', '{"day":"","n":0}'::jsonb, 'lock', 0, 'rec', '{}'::jsonb, 'vt', 0, 'sound', true, 'speed', 1, 'tab', 'village', 'seen', '{}'::jsonb)
from public.users u left join public.game g on g.user_id = u.id
where u.role = 'student'
on conflict do nothing;

-- 6. learned words: each class gets a word list (a lesson-0 plan per week, tagged with the group that met
--    each word), and each student gets the vocabulary history that puts the word on the same level:
--    old box 1..5 -> V2 stage 1..5 (Tanish .. O'zlashtirilgan).
create or replace function public._v2_idof(w text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(lower(trim(w)), '[^a-z0-9]+', '-', 'g'), '^-|-$', '', 'g') $$;
create or replace function public._v2_week(d date) returns bigint language sql immutable as $$
  select (extract(epoch from (date_trunc('week', d)::timestamp at time zone 'Asia/Tashkent')) * 1000)::bigint $$;

create temp table _lw on commit drop as
select u.id uid, 'u' || u.id sid, 'c' || u.class_id cls, p.name grp, w.en, w.uz, public._v2_idof(w.en) wid, r.box,
       coalesce(q.week_start, (w.created_at at time zone 'Asia/Tashkent')::date) wk
from public.word_review r
join public.users u on u.id = r.user_id and u.role = 'student' and u.class_id is not null
left join public.pools p on p.id = u.pool_id
join public.words w on w.id = r.word_id
left join public.quests q on q.id = w.quest_id
where public._v2_idof(w.en) <> '';

insert into public.v2_doc (coll, id, data)
select 'plans', cls || '|' || public._v2_week(wk) || '|0',
       jsonb_build_object('words', jsonb_agg(distinct jsonb_build_array(en, uz, grp)), 'note', 'Old site words')
from _lw group by cls, public._v2_week(wk)
on conflict do nothing;

-- the events that rebuild each word's level (no achko, no gold): ts/day in the past week
with base as (
  select distinct on (sid, wid) sid, wid, box,
         (current_date - 8) - date '1970-01-01' d0
  from _lw order by sid, wid, box desc
),
steps(n, fmt, dd, need) as (values
  (0, 'meet', 0, 1), (1, 'mc_meaning', 0, 2), (2, 'mc_meaning', 0, 3), (3, 'mc_word', 0, 3),
  (4, 'type_def', 1, 4), (5, 'type_def', 3, 5))
insert into public.v2_events (id, sid, ts, kind, data)
select 'imp-' || b.sid || '-' || b.wid || '-' || s.n, b.sid,
       ((b.d0 + s.dd) * 86400000::bigint) + 36000000 + s.n * 60000,
       case when s.n = 0 then 'meet' else 'vocab' end,
       jsonb_build_object('id', 'imp-' || b.sid || '-' || b.wid || '-' || s.n, 'sid', b.sid,
                          'kind', case when s.n = 0 then 'meet' else 'vocab' end,
                          'ts', ((b.d0 + s.dd) * 86400000::bigint) + 36000000 + s.n * 60000,
                          'wid', b.wid, 'day', b.d0 + s.dd)
       || case when s.n = 0 then '{}'::jsonb else jsonb_build_object('fmt', s.fmt, 'ok', true, 'rapid', false, 'input', '', 'ach', false, 'imp', true) end
from base b join steps s on b.box >= s.need
where exists (select 1 from public.v2_person where id = b.sid)
on conflict do nothing;

drop function public._v2_idof(text);
drop function public._v2_week(date);
commit;
