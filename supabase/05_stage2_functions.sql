-- Stage 2-3 functions

-- ---------- helpers ----------
create or replace function public._earn(p_user bigint, p_n int) returns void
language sql security definer set search_path = public as $$
  insert into public.castle(user_id, earned) values (p_user, p_n)
  on conflict (user_id) do update set earned = public.castle.earned + excluded.earned
$$;

create or replace function public._add_loot(p_user bigint, p_n int) returns void
language sql security definer set search_path = public as $$
  insert into public.castle(user_id, loot) values (p_user, 50 + p_n)
  on conflict (user_id) do update set loot = public.castle.loot + p_n
$$;

-- first meeting with a word inside a quest
create or replace function public._learn_word(p_user bigint, p_quest bigint, p_en text, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare wid bigint;
begin
  select id into wid from public.words where quest_id = p_quest and lower(en) = lower(p_en) order by id desc limit 1;
  if wid is null then return; end if;
  if p_ok then
    insert into public.word_review(user_id, word_id, box, due) values (p_user, wid, 1, now() + interval '2 days')
    on conflict do nothing;
  else
    insert into public.word_review(user_id, word_id, box, due) values (p_user, wid, 1, now() + interval '1 day')
    on conflict (user_id, word_id) do update set box = 1, due = now() + interval '1 day';
  end if;
end $$;

-- spaced repetition step: boxes come back after 2, 7, 21, 60, 120 days
create or replace function public._review_word(p_user bigint, p_word bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare b int;
begin
  if p_word is null then return; end if;
  select box into b from public.word_review where user_id = p_user and word_id = p_word;
  if p_ok then
    b := least(coalesce(b, 1) + 1, 5);
  else
    b := 1;
  end if;
  insert into public.word_review(user_id, word_id, box, due)
  values (p_user, p_word, b, now() + case when not p_ok then interval '1 day' else
           (array[interval '2 days', interval '7 days', interval '21 days', interval '60 days', interval '120 days'])[b] end)
  on conflict (user_id, word_id) do update set box = excluded.box, due = excluded.due;
end $$;

-- one vocabulary question built from the word bank
create or replace function public._word_question(p_word bigint, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.words; k text := p_kind; dis jsonb; q text; ans text; hint text; opts jsonb;
begin
  select * into w from public.words where id = p_word;
  if not found then return null; end if;
  if k = 'spell' and w.en !~ '^[A-Za-z''-]{2,14}$' then k := 'uz2en'; end if;
  if k = 'en2uz' then
    q := format('"%s" so''zining ma''nosi qaysi?', w.en); ans := w.uz;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into dis from (
      select x from (select distinct uz as x from public.words where lower(uz) <> lower(w.uz) and lower(en) <> lower(w.en)) d
      order by random() limit 3) t;
  elsif k = 'uz2en' then
    q := format('"%s" inglizcha qanday?', w.uz); ans := w.en;
    select coalesce(jsonb_agg(x), '[]'::jsonb) into dis from (
      select x from (select distinct en as x from public.words where lower(en) <> lower(w.en) and lower(uz) <> lower(w.uz)) d
      order by random() limit 3) t;
  end if;
  if k in ('en2uz', 'uz2en') and jsonb_array_length(dis) = 0 then
    if w.en ~ '^[A-Za-z''-]{2,14}$' then k := 'spell'; end if;
  end if;
  if k = 'spell' then
    q := w.uz; ans := w.en; hint := left(w.en, 1); opts := null;
  else
    select jsonb_agg(v order by random()) into opts from jsonb_array_elements(dis || to_jsonb(ans)) v;
  end if;
  return jsonb_build_object('kind', k, 'word_id', w.id, 'q', q, 'opts', opts, 'ans', ans, 'hint', hint,
    'why', w.en || ' = ' || w.uz || case when w.ex <> '' then '. Misol: ' || w.ex else '' end);
end $$;

-- the student-specific question behind a review slot (created once, then reused)
create or replace function public._review_slot(p_user bigint, p_quest bigint, p_slot text, p_idx int) returns public.review_slots
language plpgsql security definer set search_path = public as $$
declare r public.review_slots; uq public.users; qt public.quests; wid bigint; v_qid bigint; v_sid text; qq jsonb; k text;
begin
  select * into r from public.review_slots where user_id = p_user and quest_id = p_quest and slot = p_slot;
  if found then return r; end if;
  select * into uq from public.users where id = p_user;
  select * into qt from public.quests where id = p_quest;

  -- every third slot: a grammar question from an earlier quest (past mistakes first)
  if p_idx % 3 = 0 then
    select a.quest_id, a.step_id into v_qid, v_sid
    from public.answers a join public.quests q2 on q2.id = a.quest_id
    where a.user_id = p_user and a.kind = 'quest' and a.ok = false and a.quest_id <> p_quest
      and exists (select 1 from jsonb_array_elements(q2.steps) e where e->>'id' = a.step_id
                  and e->>'t' in ('choice', 'tf', 'gap', 'order', 'letters', 'spell') and not e ? 'p' and not e ? 'w')
      and not exists (select 1 from public.review_slots rs where rs.user_id = p_user and rs.quest_id = p_quest
                      and rs.ref_quest = a.quest_id and rs.ref_step = a.step_id)
    order by random() limit 1;
    if v_qid is null then
      select q2.id, e->>'id' into v_qid, v_sid
      from public.progress p join public.quests q2 on q2.id = p.quest_id, jsonb_array_elements(q2.steps) e
      where p.user_id = p_user and q2.id <> p_quest and q2.created_at < qt.created_at
        and e->>'t' in ('choice', 'tf', 'gap', 'order') and not e ? 'p' and not e ? 'w'
        and not exists (select 1 from public.review_slots rs where rs.user_id = p_user and rs.quest_id = p_quest
                        and rs.ref_quest = q2.id and rs.ref_step = e->>'id')
      order by random() limit 1;
    end if;
    if v_qid is not null then
      insert into public.review_slots(user_id, quest_id, slot, kind, ref_quest, ref_step)
      values (p_user, p_quest, p_slot, 'step', v_qid, v_sid) returning * into r;
      return r;
    end if;
  end if;

  -- otherwise a word: due words first, then other learned words, then the pool's older words, then this quest's words
  select wr.word_id into wid from public.word_review wr join public.words w on w.id = wr.word_id
  where wr.user_id = p_user and wr.due <= now() and w.quest_id is distinct from p_quest
    and wr.word_id not in (select rs.word_id from public.review_slots rs where rs.user_id = p_user and rs.quest_id = p_quest and rs.word_id is not null)
  order by wr.due limit 1;
  if wid is null then
    select wr.word_id into wid from public.word_review wr join public.words w on w.id = wr.word_id
    where wr.user_id = p_user and w.quest_id is distinct from p_quest
      and wr.word_id not in (select rs.word_id from public.review_slots rs where rs.user_id = p_user and rs.quest_id = p_quest and rs.word_id is not null)
    order by wr.box, random() limit 1;
  end if;
  if wid is null then
    select w.id into wid from public.words w
    where w.quest_id is distinct from p_quest and w.created_at < qt.created_at
      and (w.pool_id = uq.pool_id or w.quest_id in (select qs.quest_id from public.quest_students qs where qs.user_id = p_user))
      and w.id not in (select rs.word_id from public.review_slots rs where rs.user_id = p_user and rs.quest_id = p_quest and rs.word_id is not null)
    order by random() limit 1;
  end if;
  if wid is null then
    select w.id into wid from public.words w where w.quest_id = p_quest
      and w.id not in (select rs.word_id from public.review_slots rs where rs.user_id = p_user and rs.quest_id = p_quest and rs.word_id is not null)
    order by random() limit 1;
  end if;
  if wid is null then
    select w.id into wid from public.words w where w.quest_id = p_quest order by random() limit 1;
  end if;
  if wid is null then
    insert into public.review_slots(user_id, quest_id, slot, kind) values (p_user, p_quest, p_slot, 'none') returning * into r;
    return r;
  end if;
  k := (array['en2uz', 'uz2en', 'spell'])[1 + (p_idx % 3)];
  qq := public._word_question(wid, k);
  insert into public.review_slots(user_id, quest_id, slot, kind, word_id, q, opts, ans, hint)
  values (p_user, p_quest, p_slot, qq->>'kind', wid, qq->>'q', qq->'opts', qq->>'ans', qq->>'hint') returning * into r;
  return r;
end $$;

create or replace function public._review_view(r public.review_slots, p_c int, p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb;
begin
  if r.kind = 'step' then
    select e into s from public.quests q2, jsonb_array_elements(q2.steps) e where q2.id = r.ref_quest and e->>'id' = r.ref_step;
    if s is not null then
      return (s - 'a' - 'why' - 'whys' - 'show' - 'w') || jsonb_build_object('id', p_id, 'c', p_c, 'g', true, 'rv', true);
    end if;
  elsif r.kind = 'spell' then
    return jsonb_build_object('id', p_id, 'c', p_c, 't', 'spell', 'uz', r.q, 'hint', r.hint, 'g', true, 'rv', true);
  elsif r.kind in ('en2uz', 'uz2en') then
    return jsonb_build_object('id', p_id, 'c', p_c, 't', 'choice', 'q', r.q, 'opts', r.opts, 'g', true, 'rv', true);
  end if;
  return jsonb_build_object('id', p_id, 'c', p_c, 't', 'card', 'title', 'Takrorlash',
    'body', 'Bu yerda keyingi haftalarda eski so''zlar va qoidalar takrorlanadi. Hozircha davom eting!', 'g', true, 'rv', true);
end $$;

-- check an answer against a stored step
create or replace function public._check_step(s jsonb, p_answer text) returns boolean
language sql immutable set search_path = public as $$
  select exists (select 1 from jsonb_array_elements_text(s->'a') a where public._norm(a) = public._norm(p_answer))
$$;

create or replace function public._streak(p_user bigint) returns int
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Tashkent')::date; n int := 0;
  has boolean;
begin
  select exists (select 1 from public.answers where user_id = p_user
                 and created_at >= (d::timestamp at time zone 'Asia/Tashkent')
                 and created_at < ((d + 1)::timestamp at time zone 'Asia/Tashkent')) into has;
  if not has then d := d - 1; end if;
  loop
    select exists (select 1 from public.answers where user_id = p_user
                   and created_at >= (d::timestamp at time zone 'Asia/Tashkent')
                   and created_at < ((d + 1)::timestamp at time zone 'Asia/Tashkent')) into has;
    exit when not has or n >= 60;
    n := n + 1; d := d - 1;
  end loop;
  return n;
end $$;

-- per-student weekly numbers for one class (used by report, flags and trophies)
create or replace function public._week_stats(p_class bigint, p_week date)
returns table (uid bigint, first_name text, last_name text, pool text, quests int, finished int, late int, pct int,
               seconds int, answered int, correct int, review_ok int, practice_n int, loot_won int,
               fast_n int, fast_typed int, passage_events int)
language sql stable security definer set search_path = public as $$
  with w as (select (p_week::timestamp at time zone 'Asia/Tashkent') as ws,
                    ((p_week + 7)::timestamp at time zone 'Asia/Tashkent') as we),
  st as (select * from public.users where role = 'student' and class_id = p_class),
  aq as (
    select st.id as su, q.id as qid, q.gradable, q.deadline
    from st join public.quests q on not q.hidden and (
           (q.pool_id is not null and q.pool_id = st.pool_id)
           or exists (select 1 from public.quest_students qs where qs.quest_id = q.id and qs.user_id = st.id))
    cross join w
    where coalesce(q.deadline, q.created_at) >= w.ws and coalesce(q.deadline, q.created_at) < w.we),
  hw as (
    select aq.su, sum(aq.gradable) as g, sum(least(coalesce(p.done, 0), aq.gradable)) as d, count(*) as nq,
           count(*) filter (where p.completed_at is not null) as nfin,
           count(*) filter (where p.completed_at is not null and aq.deadline is not null and p.completed_at > aq.deadline) as nlate
    from aq left join public.progress p on p.user_id = aq.su and p.quest_id = aq.qid
    group by aq.su),
  aw as (
    select a.user_id, a.quest_id, a.step_id, a.ok, a.ms, a.kind, se.t as st_t, se.p as st_p
    from public.answers a cross join w
    left join lateral (select e->>'t' as t, e->>'p' as p from public.quests q2, jsonb_array_elements(q2.steps) e
                       where q2.id = a.quest_id and e->>'id' = a.step_id limit 1) se on true
    where a.created_at >= w.ws and a.created_at < w.we and a.user_id in (select id from st)),
  an as (
    select aw.user_id as su, sum(aw.ms) as ms,
           count(*) filter (where aw.ok is not null) as ans,
           count(*) filter (where aw.ok) as cor,
           count(*) filter (where aw.ok and aw.kind = 'review') as rv,
           count(*) filter (where aw.kind = 'practice' and aw.ok is not null) as pr,
           count(*) filter (where aw.ok is not null and aw.ms < 2500 and coalesce(aw.st_t, '') not in ('tf')) as fast,
           count(*) filter (where aw.ok and aw.ms < 1500 and aw.st_t in ('spell', 'letters', 'order')) as ftyped
    from aw group by aw.user_id),
  pe as (
    select x.user_id as su, count(*) as ev from aw x
    where x.st_t = 'read' and x.ms >= 90000
      and (select count(*) from aw y where y.user_id = x.user_id and y.quest_id = x.quest_id and y.st_p = x.step_id) >= 3
      and (select bool_and(y.ok) and avg(y.ms) < 3000 from aw y
           where y.user_id = x.user_id and y.quest_id = x.quest_id and y.st_p = x.step_id)
    group by x.user_id),
  lw as (
    select a.attacker as su, sum(a.loot) as l from public.attacks a cross join w
    where a.win and a.created_at >= w.ws and a.created_at < w.we group by a.attacker)
  select st.id, st.first_name, st.last_name, (select name from public.pools where id = st.pool_id),
    coalesce(hw.nq, 0)::int, coalesce(hw.nfin, 0)::int, coalesce(hw.nlate, 0)::int,
    case when hw.g > 0 then round(100.0 * hw.d / hw.g)::int end,
    (coalesce(an.ms, 0) / 1000)::int, coalesce(an.ans, 0)::int, coalesce(an.cor, 0)::int,
    coalesce(an.rv, 0)::int, coalesce(an.pr, 0)::int, coalesce(lw.l, 0)::int,
    coalesce(an.fast, 0)::int, coalesce(an.ftyped, 0)::int, coalesce(pe.ev, 0)::int
  from st left join hw on hw.su = st.id left join an on an.su = st.id
       left join pe on pe.su = st.id left join lw on lw.su = st.id
$$;

-- the five weekly trophies for a class
create or replace function public._week_winners(p_class bigint, p_week date) returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (select * from public._week_stats(p_class, p_week)),
  picks as (
    select 'nishonchi' as kind, (select uid from s where pct >= 80 and answered >= 20 and fast_typed < 8 and passage_events < 2
                                 order by correct::numeric / answered desc, correct desc limit 1) as uid
    union all select 'mehnat', (select uid from s where answered > 0 order by answered desc, correct desc limit 1)
    union all select 'takror', (select uid from s where review_ok > 0 order by review_ok desc, correct desc limit 1)
    union all select 'side', (select uid from s where practice_n > 0 order by practice_n desc, correct desc limit 1)
    union all select 'qomondon', (select uid from s where loot_won > 0 order by loot_won desc limit 1))
  select coalesce(jsonb_agg(jsonb_build_object('kind', p.kind, 'uid', p.uid, 'name', u.first_name || ' ' || u.last_name)), '[]'::jsonb)
  from picks p join public.users u on u.id = p.uid
$$;

-- small trophies: earned once, kept forever
create or replace function public._award_small(p_user bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.trophies(user_id, kind)
  select p_user, v.k from (values
    ('first_quest', exists (select 1 from public.progress where user_id = p_user and completed_at is not null)),
    ('streak3', public._streak(p_user) >= 3),
    ('flawless', exists (select 1 from public.progress p where p.user_id = p_user and p.completed_at is not null
                         and not exists (select 1 from public.answers a where a.user_id = p_user and a.quest_id = p.quest_id and a.ok = false))),
    ('correct50', coalesce((select earned from public.castle where user_id = p_user), 0) >= 50),
    ('words30', (select count(*) from public.word_review where user_id = p_user) >= 30),
    ('early', exists (select 1 from public.progress p join public.quests q on q.id = p.quest_id
                      where p.user_id = p_user and q.deadline is not null and p.completed_at < q.deadline - interval '24 hours')),
    ('comeback', exists (select 1 from public.answers a where a.user_id = p_user and a.ok and a.kind = 'quest'
                         and exists (select 1 from public.answers b where b.user_id = p_user and b.quest_id = a.quest_id
                                     and b.step_id = a.step_id and b.ok = false and b.created_at < a.created_at))),
    ('reader', exists (select 1 from public.answers a join public.quests q on q.id = a.quest_id
                       where a.user_id = p_user and a.ok is null
                       and exists (select 1 from jsonb_array_elements(q.steps) e where e->>'id' = a.step_id and e->>'t' = 'read'))),
    ('practice20', (select count(*) from public.answers where user_id = p_user and kind = 'practice' and ok is not null) >= 20),
    ('defender', coalesce((select defense from public.castle where user_id = p_user), 1) >= 5)
  ) v(k, ok)
  where v.ok
  on conflict do nothing;
end $$;

-- once a day: weekly trophies for finished weeks, monthly summaries, 2-month cleanup
create or replace function public._housekeeping() returns void
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Tashkent')::date; wk date; m date; c record; x jsonb;
  v_from timestamptz; v_to timestamptz;
begin
  if exists (select 1 from public.meta where key = 'housekeeping' and value = today::text) then return; end if;
  insert into public.meta(key, value) values ('housekeeping', today::text)
  on conflict (key) do update set value = excluded.value;

  for wk in select g::date from generate_series((public._week_start() - 56)::timestamp, (public._week_start() - 7)::timestamp, interval '7 days') g loop
    continue when exists (select 1 from public.meta where key = 'award:' || wk);
    for c in select id from public.classes loop
      for x in select * from jsonb_array_elements(public._week_winners(c.id, wk)) loop
        insert into public.trophies(user_id, kind, week_start, class_id)
        values ((x->>'uid')::bigint, x->>'kind', wk, c.id) on conflict do nothing;
      end loop;
    end loop;
    insert into public.meta(key, value) values ('award:' || wk, 'done') on conflict do nothing;
  end loop;

  for m in select g::date from generate_series(date_trunc('month', today::timestamp) - interval '2 months',
                                               date_trunc('month', today::timestamp) - interval '1 month', interval '1 month') g loop
    continue when exists (select 1 from public.meta where key = 'month:' || m);
    v_from := (m::timestamp at time zone 'Asia/Tashkent');
    v_to := ((m + interval '1 month')::timestamp at time zone 'Asia/Tashkent');
    insert into public.monthly_summary(user_id, month, class_id, quests, pct, seconds, answered, correct)
    select u.id, m, u.class_id,
      (select count(*) from public.quests q where not q.hidden
         and ((q.pool_id is not null and q.pool_id = u.pool_id) or exists (select 1 from public.quest_students qs where qs.quest_id = q.id and qs.user_id = u.id))
         and coalesce(q.deadline, q.created_at) >= v_from and coalesce(q.deadline, q.created_at) < v_to),
      (select round(100.0 * sum(least(coalesce(p.done, 0), q.gradable)) / nullif(sum(q.gradable), 0))::int
         from public.quests q left join public.progress p on p.quest_id = q.id and p.user_id = u.id
         where not q.hidden
           and ((q.pool_id is not null and q.pool_id = u.pool_id) or exists (select 1 from public.quest_students qs where qs.quest_id = q.id and qs.user_id = u.id))
           and coalesce(q.deadline, q.created_at) >= v_from and coalesce(q.deadline, q.created_at) < v_to),
      (select coalesce(sum(a.ms), 0) / 1000 from public.answers a where a.user_id = u.id and a.created_at >= v_from and a.created_at < v_to),
      (select count(*) from public.answers a where a.user_id = u.id and a.ok is not null and a.created_at >= v_from and a.created_at < v_to),
      (select count(*) from public.answers a where a.user_id = u.id and a.ok and a.created_at >= v_from and a.created_at < v_to)
    from public.users u where u.role = 'student'
    on conflict do nothing;
    insert into public.meta(key, value) values ('month:' || m, 'done') on conflict do nothing;
  end loop;

  delete from public.answers where created_at < now() - interval '62 days';
  delete from public.quests where created_at < now() - interval '60 days'
    and coalesce(deadline, created_at) < now() - interval '60 days';
  delete from public.attacks where created_at < now() - interval '62 days';
  delete from public.sessions where last_seen < now() - interval '60 days';
  delete from public.monthly_summary where month < (today - interval '13 months')::date;
end $$;

-- ---------- quests (replaces stage 1 versions) ----------
create or replace function public.get_quest(p_token text, p_quest bigint) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; q public.quests; st jsonb; res jsonb := '[]'::jsonb; e jsonb; idx int := 0; r public.review_slots;
begin
  u := public._auth(p_token);
  select * into q from public.quests where id = p_quest;
  if not found or not public._can_see(u, q) then raise exception 'NOT_FOUND'; end if;
  if u.role = 'student' then
    select state into st from public.progress where user_id = u.id and quest_id = q.id;
  end if;
  for e in select x from jsonb_array_elements(q.steps) x loop
    if e->>'t' = 'review' then
      idx := idx + 1;
      r := public._review_slot(u.id, q.id, e->>'id', idx);
      res := res || jsonb_build_array(public._review_view(r, (e->>'c')::int, e->>'id'));
    else
      res := res || jsonb_build_array((e - 'a' - 'why' - 'whys' - 'show' - 'w') || jsonb_build_object('g', e ? 'a'));
    end if;
  end loop;
  return json_build_object('id', q.id, 'title', q.title, 'circles', q.circles, 'deadline', q.deadline,
    'state', st, 'steps', res);
end $$;

create or replace function public.advance(p_token text, p_quest bigint, p_step text, p_answer text, p_ms int, p_state jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  u public.users; q public.quests; s jsonb; s2 jsonb; v_ok boolean; why text; v_right text; v_kind text := 'quest';
  r public.review_slots;
  v_ms int := least(greatest(coalesce(p_ms, 0), 0), 120000);
  fin int; was_done timestamptz;
begin
  u := public._auth(p_token);
  select * into q from public.quests where id = p_quest;
  if not found or not public._can_see(u, q) then raise exception 'NOT_FOUND'; end if;
  if p_state is not null and length(p_state::text) > 30000 then raise exception 'STATE_TOO_BIG'; end if;
  select e into s from jsonb_array_elements(q.steps) e where e->>'id' = p_step;
  if s is null then raise exception 'NO_STEP'; end if;

  if s->>'t' = 'review' then
    v_kind := 'review';
    select * into r from public.review_slots where user_id = u.id and quest_id = q.id and slot = p_step;
    if not found then r := public._review_slot(u.id, q.id, p_step, 1); end if;
    if r.kind = 'step' then
      select e into s2 from public.quests q2, jsonb_array_elements(q2.steps) e where q2.id = r.ref_quest and e->>'id' = r.ref_step;
    end if;
    if r.kind = 'step' and s2 is not null then
      v_ok := public._check_step(s2, p_answer);
      if not v_ok and s2 ? 'whys' then why := s2->'whys'->>public._norm(p_answer); end if;
      why := coalesce(why, s2->>'why'); v_right := s2->>'show';
    elsif r.kind in ('en2uz', 'uz2en', 'spell') then
      v_ok := public._norm(r.ans) = public._norm(p_answer); v_right := r.ans;
      select w.en || ' = ' || w.uz || case when w.ex <> '' then '. Misol: ' || w.ex else '' end into why
      from public.words w where w.id = r.word_id;
      if u.role = 'student' then perform public._review_word(u.id, r.word_id, v_ok); end if;
    else
      v_ok := true;
    end if;
  elsif s ? 'a' then
    v_ok := public._check_step(s, p_answer);
    if not v_ok and s ? 'whys' then why := s->'whys'->>public._norm(p_answer); end if;
    why := coalesce(why, s->>'why'); v_right := s->>'show';
    if u.role = 'student' and s ? 'w' then perform public._learn_word(u.id, q.id, s->>'w', v_ok); end if;
  end if;

  if u.role = 'student' then
    select completed_at into was_done from public.progress where user_id = u.id and quest_id = q.id;
    insert into public.answers(user_id, quest_id, step_id, ok, ms, kind) values (u.id, q.id, p_step, v_ok, v_ms, v_kind);
    if v_ok then perform public._earn(u.id, 1); end if;
    select count(*) into fin from (
      select a.step_id, bool_or(a.ok) o, count(*) c from public.answers a
       where a.user_id = u.id and a.quest_id = q.id and a.ok is not null and a.kind <> 'practice' group by a.step_id) t
     where o or c >= 2;
    insert into public.progress(user_id, quest_id, state, done, correct, answered, ms, completed_at, updated_at)
    values (u.id, q.id, coalesce(p_state, '{}'::jsonb), fin,
            case when v_ok then 1 else 0 end, case when v_ok is null then 0 else 1 end, v_ms,
            case when fin >= q.gradable then now() end, now())
    on conflict (user_id, quest_id) do update set
      state = coalesce(p_state, public.progress.state),
      done = excluded.done,
      correct = public.progress.correct + excluded.correct,
      answered = public.progress.answered + excluded.answered,
      ms = public.progress.ms + excluded.ms,
      completed_at = coalesce(public.progress.completed_at, excluded.completed_at),
      updated_at = now();
    if was_done is null and fin >= q.gradable then perform public._add_loot(u.id, 20); end if;
  end if;

  return json_build_object('ok', v_ok, 'right', v_right, 'why', why);
end $$;

-- ---------- student home ----------
create or replace function public.student_home(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; ws timestamptz; we timestamptz; c public.castle;
begin
  u := public._auth(p_token);
  perform public._housekeeping();
  if u.role = 'student' then perform public._award_small(u.id); end if;
  ws := (public._week_start()::timestamp at time zone 'Asia/Tashkent');
  we := ws + interval '7 days';
  select * into c from public.castle where user_id = u.id;
  return json_build_object(
    'me', json_build_object('first_name', u.first_name, 'last_name', u.last_name, 'role', u.role,
            'class', (select name from public.classes where id = u.class_id)),
    'streak', public._streak(u.id),
    'soldiers', coalesce(c.earned - c.spent, 0), 'loot', coalesce(c.loot, 50),
    'trophies', (select count(*) from public.trophies where user_id = u.id),
    'week', (select json_build_object('correct', count(*) filter (where ok), 'answered', count(*) filter (where ok is not null),
                     'seconds', coalesce(sum(ms), 0) / 1000)
             from public.answers where user_id = u.id and created_at >= ws and created_at < we),
    'quests', coalesce((
      select json_agg(x order by x.completed_at nulls first, x.deadline nulls last, x.id desc) from (
        select q.id, q.title, q.deadline, q.circles, q.gradable, q.created_at,
               coalesce(p.done, 0) as done, p.completed_at, p.state,
               (select jsonb_object_agg(e->>'id', (e->>'c')::int) from jsonb_array_elements(q.steps) e where e ? 'a') as gc
        from public.quests q
        left join public.progress p on p.quest_id = q.id and p.user_id = u.id
        where public._can_see(u, q)
          and (p.completed_at is null or p.completed_at > now() - interval '14 days')
      ) x), '[]'::json)
  );
end $$;

create or replace function public.my_trophies(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users;
begin
  u := public._auth(p_token);
  perform public._award_small(u.id);
  return json_build_object(
    'mine', coalesce((select json_agg(json_build_object('kind', kind, 'week', case when week_start > '1970-01-01' then week_start end) order by created_at desc)
                      from public.trophies where user_id = u.id), '[]'::json),
    'leaders', case when u.class_id is null then '[]'::jsonb else public._week_winners(u.class_id, public._week_start()) end);
end $$;

-- ---------- endless practice ----------
create or replace function public.practice_next(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; v_qid bigint; v_sid text; s jsonb; wid bigint; qq jsonb; k text;
begin
  u := public._auth(p_token);
  if random() < 0.5 then
    if random() < 0.6 then
      select a.quest_id, a.step_id into v_qid, v_sid from public.answers a
      where a.user_id = u.id and a.kind = 'quest' and a.ok = false order by random() limit 1;
    end if;
    if v_qid is null then
      select q.id, e->>'id' into v_qid, v_sid
      from public.progress p join public.quests q on q.id = p.quest_id, jsonb_array_elements(q.steps) e
      where p.user_id = u.id and e->>'t' in ('choice', 'tf', 'gap', 'order', 'letters', 'spell') and not e ? 'p'
      order by random() limit 1;
    end if;
    if v_qid is not null then
      select e into s from public.quests q, jsonb_array_elements(q.steps) e where q.id = v_qid and e->>'id' = v_sid;
      if s is not null and s->>'t' in ('choice', 'tf', 'gap', 'order', 'letters', 'spell') and not s ? 'p' then
        insert into public.practice(user_id, kind, ref_quest, ref_step, word_id, ans, served_at)
        values (u.id, 'step', v_qid, v_sid, null, null, now())
        on conflict (user_id) do update set kind = 'step', ref_quest = excluded.ref_quest, ref_step = excluded.ref_step,
          word_id = null, ans = null, served_at = now();
        return ((s - 'a' - 'why' - 'whys' - 'show' - 'w') || jsonb_build_object('g', true, 'id', 'practice'))::json;
      end if;
    end if;
  end if;
  select word_id into wid from public.word_review where user_id = u.id order by (due <= now()) desc, box, random() limit 1;
  if wid is null then
    select w.id into wid from public.words w where w.pool_id = u.pool_id order by random() limit 1;
  end if;
  if wid is null then return json_build_object('empty', true); end if;
  k := (array['en2uz', 'uz2en', 'spell'])[1 + floor(random() * 3)::int];
  qq := public._word_question(wid, k);
  insert into public.practice(user_id, kind, word_id, ans, ref_quest, ref_step, served_at)
  values (u.id, qq->>'kind', wid, qq->>'ans', null, null, now())
  on conflict (user_id) do update set kind = excluded.kind, word_id = excluded.word_id, ans = excluded.ans,
    ref_quest = null, ref_step = null, served_at = now();
  if qq->>'kind' = 'spell' then
    return json_build_object('id', 'practice', 't', 'spell', 'uz', qq->>'q', 'hint', qq->>'hint', 'g', true);
  end if;
  return json_build_object('id', 'practice', 't', 'choice', 'q', qq->>'q', 'opts', qq->'opts', 'g', true);
end $$;

create or replace function public.practice_answer(p_token text, p_answer text, p_ms int) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; pr public.practice; s jsonb; v_ok boolean; why text; v_right text;
begin
  u := public._auth(p_token);
  select * into pr from public.practice where user_id = u.id;
  if not found then return json_build_object('error', 'NO_QUESTION'); end if;
  if pr.kind = 'step' then
    select e into s from public.quests q, jsonb_array_elements(q.steps) e where q.id = pr.ref_quest and e->>'id' = pr.ref_step;
    if s is null then delete from public.practice where user_id = u.id; return json_build_object('error', 'NO_QUESTION'); end if;
    v_ok := public._check_step(s, p_answer);
    if not v_ok and s ? 'whys' then why := s->'whys'->>public._norm(p_answer); end if;
    why := coalesce(why, s->>'why'); v_right := s->>'show';
  else
    v_ok := public._norm(pr.ans) = public._norm(p_answer); v_right := pr.ans;
    select w.en || ' = ' || w.uz || case when w.ex <> '' then '. Misol: ' || w.ex else '' end into why
    from public.words w where w.id = pr.word_id;
    perform public._review_word(u.id, pr.word_id, v_ok);
  end if;
  insert into public.answers(user_id, quest_id, step_id, ok, ms, kind)
  values (u.id, null, 'practice', v_ok, least(greatest(coalesce(p_ms, 0), 0), 120000), 'practice');
  if v_ok then perform public._earn(u.id, 1); end if;
  delete from public.practice where user_id = u.id;
  return json_build_object('ok', v_ok, 'right', v_right, 'why', why);
end $$;

-- ---------- castle game ----------
create or replace function public.castle_state(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; c public.castle;
begin
  u := public._auth(p_token);
  insert into public.castle(user_id) values (u.id) on conflict do nothing;
  select * into c from public.castle where user_id = u.id;
  return json_build_object(
    'me', json_build_object('soldiers', c.earned - c.spent, 'defense', c.defense, 'loot', c.loot),
    'others', coalesce((
      select json_agg(json_build_object('id', s.id,
               'name', s.first_name || coalesce(' ' || nullif(left(s.last_name, 1), '') || '.', ''),
               'defense', coalesce(k.defense, 1), 'loot', coalesce(k.loot, 50),
               'cooldown', exists (select 1 from public.attacks a where a.attacker = u.id and a.defender = s.id
                                   and a.created_at > now() - interval '1 hour'))
             order by coalesce(k.loot, 50) desc)
      from public.users s left join public.castle k on k.user_id = s.id
      where s.role = 'student' and u.class_id is not null and s.class_id = u.class_id and s.id <> u.id), '[]'::json),
    'log', coalesce((
      select json_agg(x order by x.at desc) from (
        select a.created_at as at, a.win, a.loot, (a.attacker = u.id) as mine,
               case when a.attacker = u.id then d.first_name else t.first_name end as other
        from public.attacks a join public.users t on t.id = a.attacker join public.users d on d.id = a.defender
        where a.attacker = u.id or a.defender = u.id
        order by a.created_at desc limit 6) x), '[]'::json));
end $$;

create or replace function public.castle_defend(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; c public.castle;
begin
  u := public._auth(p_token);
  insert into public.castle(user_id) values (u.id) on conflict do nothing;
  select * into c from public.castle where user_id = u.id for update;
  if c.earned - c.spent < 5 then return json_build_object('error', 'NO_SOLDIERS'); end if;
  if c.defense >= 20 then return json_build_object('error', 'MAX'); end if;
  update public.castle set spent = spent + 5, defense = defense + 1 where user_id = u.id;
  return json_build_object('ok', true);
end $$;

create or replace function public.castle_attack(p_token text, p_target bigint) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; t public.users; c public.castle; tc public.castle; win boolean; got int := 0;
begin
  u := public._auth(p_token);
  select * into t from public.users where id = p_target and role = 'student';
  if not found or t.id = u.id or u.class_id is null or t.class_id is distinct from u.class_id then
    return json_build_object('error', 'BAD_TARGET');
  end if;
  insert into public.castle(user_id) values (u.id) on conflict do nothing;
  insert into public.castle(user_id) values (t.id) on conflict do nothing;
  select * into c from public.castle where user_id = u.id for update;
  select * into tc from public.castle where user_id = t.id for update;
  if c.earned - c.spent < 10 then return json_build_object('error', 'NO_SOLDIERS'); end if;
  if exists (select 1 from public.attacks where attacker = u.id and defender = t.id and created_at > now() - interval '1 hour') then
    return json_build_object('error', 'COOLDOWN');
  end if;
  update public.castle set spent = spent + 10 where user_id = u.id;
  win := random() < 10.0 / (10 + tc.defense * 4);
  if win then
    got := least(25, floor(tc.loot * 0.15)::int);
    update public.castle set loot = loot - got where user_id = t.id;
    update public.castle set loot = loot + got where user_id = u.id;
  end if;
  insert into public.attacks(attacker, defender, win, loot) values (u.id, t.id, win, got);
  return json_build_object('win', win, 'loot', got, 'name', t.first_name);
end $$;

-- ---------- mistake reports ----------
create or replace function public.report_problem(p_token text, p_quest bigint, p_step text, p_note text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; q public.quests;
begin
  u := public._auth(p_token);
  select * into q from public.quests where id = p_quest;
  if not found or not public._can_see(u, q) then raise exception 'NOT_FOUND'; end if;
  if (select count(*) from public.reports where user_id = u.id and created_at > now() - interval '1 day') >= 20 then
    return json_build_object('error', 'TOO_MANY');
  end if;
  insert into public.reports(user_id, quest_id, step_id, note) values (u.id, q.id, left(coalesce(p_step, ''), 20), left(coalesce(p_note, ''), 500));
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_problems(p_token text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  return coalesce((
    select json_agg(json_build_object('id', r.id, 'quest_id', r.quest_id, 'quest', q.title, 'step', r.step_id,
             'student', coalesce(u.first_name || ' ' || u.last_name, '—'), 'note', r.note, 'at', r.created_at,
             'text', (select coalesce(e->>'q', e->>'uz', concat_ws(' ___ ', e->>'before', e->>'after'), e->>'title')
                      from jsonb_array_elements(q.steps) e where e->>'id' = r.step_id limit 1))
           order by r.created_at desc)
    from public.reports r join public.quests q on q.id = r.quest_id left join public.users u on u.id = r.user_id
    where not r.resolved), '[]'::json);
end $$;

create or replace function public.admin_problem_resolve(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  update public.reports set resolved = true where id = p_id;
end $$;

-- ---------- teacher ----------
create or replace function public.admin_report(p_token text, p_class bigint, p_week date) returns json
language plpgsql security definer set search_path = public as $$
declare d date;
begin
  perform public._teacher(p_token);
  perform public._housekeeping();
  d := public._week_start(p_week);
  return json_build_object('week_start', d,
    'winners', public._week_winners(p_class, d),
    'rows', coalesce((select json_agg(json_build_object(
      'id', s.uid, 'first_name', s.first_name, 'last_name', s.last_name, 'pool', s.pool,
      'quests', s.quests, 'finished', s.finished, 'late', s.late, 'pct', s.pct, 'seconds', s.seconds,
      'answered', s.answered, 'correct', s.correct, 'review_ok', s.review_ok, 'practice_n', s.practice_n,
      'flag', case
        when s.passage_events >= 2 or s.fast_typed >= 8 then json_build_object('kind', 'red', 'text',
          'Shubhali: ' || case when s.passage_events >= 2
            then 'o''qish matnida uzoq to''xtab, keyin barcha savollarga g''ayrioddiy tez va xatosiz javob bergan (' || s.passage_events || ' marta).'
            else 'so''z yasash va tartiblash javoblarini g''ayrioddiy tez va xatosiz kiritgan (' || s.fast_typed || ' marta).' end
          || ' Begona yordam ehtimoli bor.')
        when s.answered >= 15 and s.fast_n::numeric / s.answered >= 0.4 and s.correct::numeric / s.answered < 0.6
          then json_build_object('kind', 'amber', 'text',
            'Bu o''quvchi e''tiborsizlik bilan ishlagan bo''lishi ehtimoli katta: ko''p savollarga juda tez javob bergan, aniqligi '
            || round(100.0 * s.correct / s.answered) || '%.')
      end))
    from public._week_stats(p_class, d) s), '[]'::json));
end $$;

create or replace function public.admin_monthly(p_token text, p_class bigint) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  return coalesce((
    select json_agg(json_build_object('name', u.first_name || ' ' || u.last_name, 'month', m.month, 'pct', m.pct,
             'seconds', m.seconds, 'answered', m.answered, 'correct', m.correct, 'quests', m.quests)
           order by m.month desc, u.first_name)
    from public.monthly_summary m join public.users u on u.id = m.user_id
    where u.class_id = p_class and m.month >= (now() - interval '7 months')::date), '[]'::json);
end $$;

create or replace function public.admin_data(p_token text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  perform public._housekeeping();
  return json_build_object(
    'classes', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name,
                  'n', (select count(*) from public.users where class_id = c.id and role = 'student')) order by c.name)
                  from public.classes c), '[]'::json),
    'pools', coalesce((select json_agg(json_build_object('id', p.id, 'name', p.name,
                  'n', (select count(*) from public.users where pool_id = p.id and role = 'student')) order by p.name)
                  from public.pools p), '[]'::json),
    'students', coalesce((select json_agg(json_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name,
                  'login', s.login, 'class_id', s.class_id, 'pool_id', s.pool_id) order by s.first_name, s.last_name)
                  from public.users s where s.role = 'student'), '[]'::json),
    'quests', coalesce((select json_agg(json_build_object('id', q.id, 'title', q.title, 'pool_id', q.pool_id,
                  'deadline', q.deadline, 'hidden', q.hidden, 'created_at', q.created_at, 'gradable', q.gradable,
                  'circles', q.circles,
                  'students', coalesce((select json_agg(user_id) from public.quest_students where quest_id = q.id), '[]'::json),
                  'finished', (select count(*) from public.progress where quest_id = q.id and completed_at is not null),
                  'problems', (select count(*) from public.reports where quest_id = q.id and not resolved))
                  order by q.created_at desc) from public.quests q), '[]'::json),
    'problems', (select count(*) from public.reports where not resolved)
  );
end $$;

create or replace function public.admin_quests_create(p_token text, p_quests jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare r jsonb; ids bigint[] := '{}'; nid bigint;
begin
  perform public._teacher(p_token);
  for r in select * from jsonb_array_elements(p_quests) loop
    if jsonb_typeof(r->'steps') <> 'array' then raise exception 'BAD_STEPS'; end if;
    insert into public.quests(title, pool_id, script, steps, circles, gradable)
    values (r->>'title', nullif(r->>'pool_id', '')::bigint, coalesce(r->>'script', ''), r->'steps', r->'circles',
            (select count(*) from jsonb_array_elements(r->'steps') e where e ? 'a'))
    returning id into nid;
    insert into public.words(quest_id, pool_id, en, uz, ex)
    select nid, nullif(r->>'pool_id', '')::bigint, e->>'en', e->>'uz', coalesce(e->>'ex', '')
    from jsonb_array_elements(r->'steps') e where e->>'t' = 'word';
    ids := ids || nid;
  end loop;
  return json_build_object('ids', ids);
end $$;

create or replace function public.admin_quest_update(p_token text, p_id bigint, p_title text, p_pool bigint,
  p_deadline timestamptz, p_hidden boolean, p_students bigint[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  update public.quests set title = trim(p_title), pool_id = p_pool, deadline = p_deadline, hidden = coalesce(p_hidden, false)
   where id = p_id;
  update public.words set pool_id = p_pool where quest_id = p_id;
  if p_students is not null then
    delete from public.quest_students where quest_id = p_id;
    insert into public.quest_students(quest_id, user_id)
      select p_id, s from unnest(p_students) s where exists (select 1 from public.users where id = s and role = 'student');
  end if;
end $$;

-- ---------- permissions ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.login(text, text), public.logout(text),
  public.student_home(text), public.get_quest(text, bigint),
  public.advance(text, bigint, text, text, int, jsonb), public.save_state(text, bigint, jsonb),
  public.class_board(text), public.my_trophies(text),
  public.practice_next(text), public.practice_answer(text, text, int),
  public.castle_state(text), public.castle_defend(text), public.castle_attack(text, bigint),
  public.report_problem(text, bigint, text, text),
  public.admin_data(text), public.admin_class_save(text, bigint, text), public.admin_class_delete(text, bigint),
  public.admin_pool_save(text, bigint, text), public.admin_pool_delete(text, bigint),
  public.admin_students_add(text, jsonb), public.admin_student_update(text, bigint, text, text, bigint, bigint),
  public.admin_set_password(text, bigint, text), public.admin_student_delete(text, bigint),
  public.admin_change_password(text, text, text),
  public.admin_quests_create(text, jsonb),
  public.admin_quest_update(text, bigint, text, bigint, timestamptz, boolean, bigint[]),
  public.admin_quest_delete(text, bigint), public.admin_report(text, bigint, date),
  public.admin_monthly(text, bigint), public.admin_problems(text), public.admin_problem_resolve(text, bigint)
to anon;
