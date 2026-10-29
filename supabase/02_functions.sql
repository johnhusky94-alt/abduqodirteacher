-- Abduqodir Teacher: API functions (stage 1)

-- ---------- helpers (not callable from the website) ----------
create or replace function public._norm(t text) returns text
language sql immutable set search_path = public as $$
  select lower(trim(regexp_replace(
           regexp_replace(translate(coalesce(t, ''), E'’‘`ʻʼ', ''''''''''''), '\s+', ' ', 'g'),
           '[\s\.\!\?,;:]+$', '')))
$$;

create or replace function public._auth(p_token text) returns public.users
language plpgsql security definer set search_path = public as $$
declare u public.users;
begin
  select us.* into u from public.sessions s join public.users us on us.id = s.user_id
   where s.token = p_token and s.last_seen > now() - interval '60 days';
  if not found then raise exception 'AUTH'; end if;
  update public.sessions set last_seen = now() where token = p_token and last_seen < now() - interval '1 hour';
  return u;
end $$;

create or replace function public._teacher(p_token text) returns public.users
language plpgsql security definer set search_path = public as $$
declare u public.users;
begin
  u := public._auth(p_token);
  if u.role <> 'teacher' then raise exception 'FORBIDDEN'; end if;
  return u;
end $$;

create or replace function public._can_see(u public.users, q public.quests) returns boolean
language sql stable security definer set search_path = public as $$
  select u.role = 'teacher' or (not q.hidden and (
    (q.pool_id is not null and q.pool_id = u.pool_id)
    or exists (select 1 from public.quest_students qs where qs.quest_id = q.id and qs.user_id = u.id)))
$$;

create or replace function public._week_start(p_day date default null) returns date
language sql stable as $$
  select date_trunc('week', coalesce(p_day, (now() at time zone 'Asia/Tashkent')::date))::date
$$;

-- ---------- login ----------
create or replace function public.login(p_login text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u public.users; t text;
begin
  select * into u from public.users where login = lower(trim(coalesce(p_login, '')));
  if not found then
    perform pg_sleep(0.3);
    return json_build_object('error', 'BAD_LOGIN');
  end if;
  if u.locked_until is not null and u.locked_until > now() then
    return json_build_object('error', 'LOCKED');
  end if;
  if u.pass_hash <> crypt(coalesce(p_password, ''), u.pass_hash) then
    update public.users set failed = failed + 1,
      locked_until = case when failed + 1 >= 8 then now() + interval '2 minutes' else null end
      where id = u.id;
    return json_build_object('error', 'BAD_LOGIN');
  end if;
  update public.users set failed = 0, locked_until = null where id = u.id;
  t := encode(gen_random_bytes(24), 'hex');
  insert into public.sessions(token, user_id) values (t, u.id);
  delete from public.sessions where user_id = u.id and last_seen < now() - interval '60 days';
  return json_build_object('token', t, 'role', u.role, 'first_name', u.first_name, 'last_name', u.last_name);
end $$;

create or replace function public.logout(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.sessions where token = p_token
$$;

-- ---------- student ----------
create or replace function public.student_home(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; ws timestamptz; we timestamptz;
begin
  u := public._auth(p_token);
  ws := (public._week_start()::timestamp at time zone 'Asia/Tashkent');
  we := ws + interval '7 days';
  return json_build_object(
    'me', json_build_object('first_name', u.first_name, 'last_name', u.last_name, 'role', u.role,
            'class', (select name from public.classes where id = u.class_id)),
    'week', (select json_build_object('correct', count(*) filter (where ok), 'answered', count(*) filter (where ok is not null),
                     'seconds', coalesce(sum(ms), 0) / 1000)
             from public.answers where user_id = u.id and created_at >= ws and created_at < we),
    'quests', coalesce((
      select json_agg(x order by x.completed_at nulls first, x.deadline nulls last, x.id desc) from (
        select q.id, q.title, q.deadline, q.circles, q.gradable, q.created_at,
               coalesce(p.done, 0) as done, p.completed_at, p.state,
               (select array_agg(e->>'id') from jsonb_array_elements(q.steps) e where e ? 'a') as gids,
               (select jsonb_object_agg(e->>'id', (e->>'c')::int) from jsonb_array_elements(q.steps) e where e ? 'a') as gc
        from public.quests q
        left join public.progress p on p.quest_id = q.id and p.user_id = u.id
        where public._can_see(u, q)
          and (p.completed_at is null or p.completed_at > now() - interval '14 days')
      ) x), '[]'::json)
  );
end $$;

create or replace function public.get_quest(p_token text, p_quest bigint) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; q public.quests; st jsonb;
begin
  u := public._auth(p_token);
  select * into q from public.quests where id = p_quest;
  if not found or not public._can_see(u, q) then raise exception 'NOT_FOUND'; end if;
  if u.role = 'student' then
    select state into st from public.progress where user_id = u.id and quest_id = q.id;
  end if;
  return json_build_object('id', q.id, 'title', q.title, 'circles', q.circles, 'deadline', q.deadline,
    'state', st,
    'steps', (select jsonb_agg((e - 'a' - 'why' - 'whys' - 'show') || jsonb_build_object('g', e ? 'a') order by o)
              from jsonb_array_elements(q.steps) with ordinality as t(e, o)));
end $$;

create or replace function public.advance(p_token text, p_quest bigint, p_step text, p_answer text, p_ms int, p_state jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  u public.users; q public.quests; s jsonb; ok boolean; why text;
  v_ms int := least(greatest(coalesce(p_ms, 0), 0), 120000);
  fin int;
begin
  u := public._auth(p_token);
  select * into q from public.quests where id = p_quest;
  if not found or not public._can_see(u, q) then raise exception 'NOT_FOUND'; end if;
  if p_state is not null and length(p_state::text) > 30000 then raise exception 'STATE_TOO_BIG'; end if;
  select e into s from jsonb_array_elements(q.steps) e where e->>'id' = p_step;
  if s is null then raise exception 'NO_STEP'; end if;

  if s ? 'a' then
    ok := exists (select 1 from jsonb_array_elements_text(s->'a') a where public._norm(a) = public._norm(p_answer));
    if not ok and s ? 'whys' then why := s->'whys'->>public._norm(p_answer); end if;
    why := coalesce(why, s->>'why');
  end if;

  if u.role = 'student' then
    insert into public.answers(user_id, quest_id, step_id, ok, ms) values (u.id, q.id, p_step, ok, v_ms);
    select count(*) into fin from (
      select step_id, bool_or(ok) o, count(*) c from public.answers
       where user_id = u.id and quest_id = q.id and ok is not null group by step_id) t
     where o or c >= 2;
    insert into public.progress(user_id, quest_id, state, done, correct, answered, ms, completed_at, updated_at)
    values (u.id, q.id, coalesce(p_state, '{}'::jsonb), fin,
            case when ok then 1 else 0 end, case when ok is null then 0 else 1 end, v_ms,
            case when fin >= q.gradable then now() end, now())
    on conflict (user_id, quest_id) do update set
      state = coalesce(p_state, public.progress.state),
      done = excluded.done,
      correct = public.progress.correct + excluded.correct,
      answered = public.progress.answered + excluded.answered,
      ms = public.progress.ms + excluded.ms,
      completed_at = coalesce(public.progress.completed_at, excluded.completed_at),
      updated_at = now();
  end if;

  return json_build_object('ok', ok, 'right', s->>'show', 'why', why);
end $$;

create or replace function public.save_state(p_token text, p_quest bigint, p_state jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare u public.users; q public.quests;
begin
  u := public._auth(p_token);
  if u.role <> 'student' then return; end if;
  select * into q from public.quests where id = p_quest;
  if not found or not public._can_see(u, q) then raise exception 'NOT_FOUND'; end if;
  if length(p_state::text) > 30000 then raise exception 'STATE_TOO_BIG'; end if;
  insert into public.progress(user_id, quest_id, state) values (u.id, q.id, p_state)
  on conflict (user_id, quest_id) do update set state = excluded.state, updated_at = now();
end $$;

create or replace function public.class_board(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; ws timestamptz;
begin
  u := public._auth(p_token);
  ws := (public._week_start()::timestamp at time zone 'Asia/Tashkent');
  return coalesce((
    select json_agg(json_build_object('name', st.first_name || coalesce(' ' || nullif(left(st.last_name, 1), '') || '.', ''),
                                      'points', coalesce(a.pts, 0), 'me', st.id = u.id)
                    order by coalesce(a.pts, 0) desc, st.first_name)
    from public.users st
    left join (select user_id, count(*) filter (where ok) pts from public.answers
                where created_at >= ws group by user_id) a on a.user_id = st.id
    where st.role = 'student' and st.class_id = u.class_id and u.class_id is not null), '[]'::json);
end $$;

-- ---------- teacher ----------
create or replace function public.admin_data(p_token text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
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
                  'finished', (select count(*) from public.progress where quest_id = q.id and completed_at is not null))
                  order by q.created_at desc) from public.quests q), '[]'::json)
  );
end $$;

create or replace function public.admin_class_save(p_token text, p_id bigint, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  if p_id is null then insert into public.classes(name) values (trim(p_name));
  else update public.classes set name = trim(p_name) where id = p_id; end if;
end $$;

create or replace function public.admin_class_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  delete from public.classes where id = p_id;
end $$;

create or replace function public.admin_pool_save(p_token text, p_id bigint, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  if p_id is null then insert into public.pools(name) values (trim(p_name));
  else update public.pools set name = trim(p_name) where id = p_id; end if;
end $$;

create or replace function public.admin_pool_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  delete from public.pools where id = p_id;
end $$;

create or replace function public.admin_students_add(p_token text, p_rows jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; added int := 0; errs jsonb := '[]'::jsonb; lg text;
begin
  perform public._teacher(p_token);
  for r in select * from jsonb_array_elements(p_rows) loop
    lg := lower(trim(r->>'login'));
    begin
      if char_length(coalesce(r->>'password', '')) < 4 then raise exception 'Parol kamida 4 belgi bo''lishi kerak'; end if;
      if lg !~ '^[a-z0-9_.]{3,30}$' then raise exception 'Login faqat lotin harflari, raqam, _ va . (3-30 belgi)'; end if;
      insert into public.users(role, first_name, last_name, login, pass_hash, class_id, pool_id)
      values ('student', trim(r->>'first_name'), coalesce(trim(r->>'last_name'), ''), lg,
              crypt(r->>'password', gen_salt('bf', 8)),
              nullif(r->>'class_id', '')::bigint, nullif(r->>'pool_id', '')::bigint);
      added := added + 1;
    exception
      when unique_violation then errs := errs || jsonb_build_object('login', lg, 'error', 'Bu login band');
      when others then errs := errs || jsonb_build_object('login', lg, 'error', sqlerrm);
    end;
  end loop;
  return json_build_object('added', added, 'errors', errs);
end $$;

create or replace function public.admin_student_update(p_token text, p_id bigint, p_first text, p_last text, p_class bigint, p_pool bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  update public.users set first_name = trim(p_first), last_name = coalesce(trim(p_last), ''),
         class_id = p_class, pool_id = p_pool
   where id = p_id and role = 'student';
end $$;

create or replace function public.admin_set_password(p_token text, p_id bigint, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._teacher(p_token);
  if char_length(coalesce(p_password, '')) < 4 then raise exception 'Parol kamida 4 belgi bo''lishi kerak'; end if;
  update public.users set pass_hash = crypt(p_password, gen_salt('bf', 8)), failed = 0, locked_until = null
   where id = p_id and role = 'student';
  delete from public.sessions where user_id = p_id;
end $$;

create or replace function public.admin_student_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  delete from public.users where id = p_id and role = 'student';
end $$;

create or replace function public.admin_change_password(p_token text, p_old text, p_new text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare u public.users;
begin
  u := public._teacher(p_token);
  if u.pass_hash <> crypt(coalesce(p_old, ''), u.pass_hash) then return json_build_object('error', 'OLD_WRONG'); end if;
  if char_length(coalesce(p_new, '')) < 8 then return json_build_object('error', 'TOO_SHORT'); end if;
  update public.users set pass_hash = crypt(p_new, gen_salt('bf', 8)) where id = u.id;
  delete from public.sessions where user_id = u.id and token <> p_token;
  return json_build_object('ok', true);
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
  if p_students is not null then
    delete from public.quest_students where quest_id = p_id;
    insert into public.quest_students(quest_id, user_id)
      select p_id, s from unnest(p_students) s where exists (select 1 from public.users where id = s and role = 'student');
  end if;
end $$;

create or replace function public.admin_quest_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._teacher(p_token);
  delete from public.quests where id = p_id;
end $$;

create or replace function public.admin_report(p_token text, p_class bigint, p_week date) returns json
language plpgsql security definer set search_path = public as $$
declare ws timestamptz; we timestamptz; d date;
begin
  perform public._teacher(p_token);
  d := public._week_start(p_week);
  ws := (d::timestamp at time zone 'Asia/Tashkent');
  we := ws + interval '7 days';
  return json_build_object('week_start', d, 'rows', coalesce((
    with st as (select * from public.users where role = 'student' and class_id = p_class),
    aq as (
      select st.id uid, q.id qid, q.gradable, q.deadline
      from st join public.quests q on not q.hidden and (
             (q.pool_id is not null and q.pool_id = st.pool_id)
             or exists (select 1 from public.quest_students qs where qs.quest_id = q.id and qs.user_id = st.id))
      where coalesce(q.deadline, q.created_at) >= ws and coalesce(q.deadline, q.created_at) < we),
    hw as (
      select aq.uid, sum(aq.gradable) g, sum(least(coalesce(p.done, 0), aq.gradable)) d, count(*) nq,
             count(*) filter (where p.completed_at is not null) nfin,
             count(*) filter (where p.completed_at is not null and aq.deadline is not null and p.completed_at > aq.deadline) nlate
      from aq left join public.progress p on p.user_id = aq.uid and p.quest_id = aq.qid
      group by aq.uid),
    an as (
      select a.user_id uid, sum(a.ms) ms, count(*) filter (where a.ok is not null) answered, count(*) filter (where a.ok) correct
      from public.answers a where a.created_at >= ws and a.created_at < we and a.user_id in (select id from st)
      group by a.user_id)
    select json_agg(json_build_object(
      'id', st.id, 'first_name', st.first_name, 'last_name', st.last_name,
      'pool', (select name from public.pools where id = st.pool_id),
      'quests', coalesce(hw.nq, 0), 'finished', coalesce(hw.nfin, 0), 'late', coalesce(hw.nlate, 0),
      'pct', case when hw.g > 0 then round(100.0 * hw.d / hw.g) end,
      'seconds', coalesce(an.ms, 0) / 1000, 'answered', coalesce(an.answered, 0), 'correct', coalesce(an.correct, 0)))
    from st left join hw on hw.uid = st.id left join an on an.uid = st.id), '[]'::json));
end $$;

-- ---------- permissions ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.login(text, text), public.logout(text),
  public.student_home(text), public.get_quest(text, bigint),
  public.advance(text, bigint, text, text, int, jsonb), public.save_state(text, bigint, jsonb),
  public.class_board(text),
  public.admin_data(text), public.admin_class_save(text, bigint, text), public.admin_class_delete(text, bigint),
  public.admin_pool_save(text, bigint, text), public.admin_pool_delete(text, bigint),
  public.admin_students_add(text, jsonb), public.admin_student_update(text, bigint, text, text, bigint, bigint),
  public.admin_set_password(text, bigint, text), public.admin_student_delete(text, bigint),
  public.admin_change_password(text, text, text),
  public.admin_quests_create(text, jsonb),
  public.admin_quest_update(text, bigint, text, bigint, timestamptz, boolean, bigint[]),
  public.admin_quest_delete(text, bigint), public.admin_report(text, bigint, date)
to anon;
