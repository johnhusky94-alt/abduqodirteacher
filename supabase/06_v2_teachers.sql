-- V2 stage 1: several teachers. Each teacher owns classes, pools, students and quests.
-- The main admin manages teachers and can look at any teacher's data ("act as").

create or replace function public._tid(p_token text) returns bigint
language plpgsql security definer set search_path = public as $$
declare u public.users; a bigint;
begin
  u := public._teacher(p_token);
  select act_as into a from public.sessions where token = p_token;
  if u.is_admin and a is not null then return a; end if;
  return u.id;
end $$;

create or replace function public._admin(p_token text) returns public.users
language plpgsql security definer set search_path = public as $$
declare u public.users;
begin
  u := public._teacher(p_token);
  if not u.is_admin then raise exception 'FORBIDDEN'; end if;
  return u;
end $$;

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
  return json_build_object('token', t, 'role', u.role, 'first_name', u.first_name, 'last_name', u.last_name, 'is_admin', u.is_admin);
end $$;

create or replace function public.teacher_me(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; a public.users; aid bigint;
begin
  u := public._teacher(p_token);
  select act_as into aid from public.sessions where token = p_token;
  if u.is_admin and aid is not null then select * into a from public.users where id = aid; end if;
  return json_build_object('first_name', u.first_name, 'last_name', u.last_name, 'is_admin', u.is_admin,
    'acting', case when a.id is not null then json_build_object('id', a.id, 'name', a.first_name || ' ' || a.last_name) end);
end $$;

-- ---------- teacher management (main admin only) ----------
create or replace function public.admin_teachers(p_token text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform public._admin(p_token);
  return coalesce((select json_agg(json_build_object('id', t.id, 'first_name', t.first_name, 'last_name', t.last_name,
      'login', t.login, 'is_admin', t.is_admin,
      'classes', (select count(*) from public.classes where teacher_id = t.id),
      'students', (select count(*) from public.users where teacher_id = t.id and role = 'student'))
    order by t.is_admin desc, t.first_name)
    from public.users t where t.role = 'teacher'), '[]'::json);
end $$;

create or replace function public.admin_teacher_add(p_token text, p_first text, p_last text, p_login text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare lg text := lower(trim(coalesce(p_login, '')));
begin
  perform public._admin(p_token);
  if char_length(coalesce(p_password, '')) < 6 then return json_build_object('error', 'Parol kamida 6 belgi bo''lsin'); end if;
  if lg !~ '^[a-z0-9_.]{3,30}$' then return json_build_object('error', 'Login: lotin harflari va raqamlar, 3-30 belgi'); end if;
  if exists (select 1 from public.users where login = lg) then return json_build_object('error', 'Bu login band'); end if;
  insert into public.users(role, first_name, last_name, login, pass_hash)
  values ('teacher', trim(p_first), coalesce(trim(p_last), ''), lg, crypt(p_password, gen_salt('bf', 8)));
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_teacher_update(p_token text, p_id bigint, p_first text, p_last text, p_login text) returns json
language plpgsql security definer set search_path = public as $$
declare lg text := lower(trim(coalesce(p_login, '')));
begin
  perform public._admin(p_token);
  if lg !~ '^[a-z0-9_.]{3,30}$' then return json_build_object('error', 'Login: lotin harflari va raqamlar, 3-30 belgi'); end if;
  if exists (select 1 from public.users where login = lg and id <> p_id) then return json_build_object('error', 'Bu login band'); end if;
  update public.users set first_name = trim(p_first), last_name = coalesce(trim(p_last), ''), login = lg
   where id = p_id and role = 'teacher';
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_teacher_password(p_token text, p_id bigint, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._admin(p_token);
  if char_length(coalesce(p_password, '')) < 6 then return json_build_object('error', 'Parol kamida 6 belgi bo''lsin'); end if;
  update public.users set pass_hash = crypt(p_password, gen_salt('bf', 8)), failed = 0, locked_until = null
   where id = p_id and role = 'teacher';
  delete from public.sessions where user_id = p_id and token <> p_token;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_teacher_delete(p_token text, p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users;
begin
  u := public._admin(p_token);
  if p_id = u.id then return json_build_object('error', 'O''zingizni o''chira olmaysiz'); end if;
  delete from public.users where id = p_id and role = 'teacher' and not is_admin;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_act_as(p_token text, p_teacher bigint) returns void
language plpgsql security definer set search_path = public as $$
declare u public.users;
begin
  u := public._admin(p_token);
  update public.sessions set act_as = case when p_teacher is null or p_teacher = u.id then null else
    (select id from public.users where id = p_teacher and role = 'teacher') end
  where token = p_token;
end $$;

-- ---------- teacher functions, now scoped to the teacher ----------
create or replace function public.admin_data(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare tid bigint;
begin
  tid := public._tid(p_token);
  perform public._housekeeping();
  return json_build_object(
    'classes', coalesce((select json_agg(json_build_object('id', c.id, 'name', c.name,
                  'n', (select count(*) from public.users where class_id = c.id and role = 'student')) order by c.name)
                  from public.classes c where c.teacher_id = tid), '[]'::json),
    'pools', coalesce((select json_agg(json_build_object('id', p.id, 'name', p.name,
                  'n', (select count(*) from public.users where pool_id = p.id and role = 'student')) order by p.name)
                  from public.pools p where p.teacher_id = tid), '[]'::json),
    'students', coalesce((select json_agg(json_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name,
                  'login', s.login, 'class_id', s.class_id, 'pool_id', s.pool_id) order by s.first_name, s.last_name)
                  from public.users s where s.role = 'student' and s.teacher_id = tid), '[]'::json),
    'quests', coalesce((select json_agg(json_build_object('id', q.id, 'title', q.title, 'pool_id', q.pool_id,
                  'deadline', q.deadline, 'hidden', q.hidden, 'created_at', q.created_at, 'gradable', q.gradable,
                  'circles', q.circles,
                  'students', coalesce((select json_agg(user_id) from public.quest_students where quest_id = q.id), '[]'::json),
                  'finished', (select count(*) from public.progress where quest_id = q.id and completed_at is not null),
                  'problems', (select count(*) from public.reports where quest_id = q.id and not resolved))
                  order by q.created_at desc) from public.quests q where q.teacher_id = tid), '[]'::json),
    'problems', (select count(*) from public.reports r join public.quests q on q.id = r.quest_id
                 where not r.resolved and q.teacher_id = tid)
  );
end $$;

create or replace function public.admin_class_save(p_token text, p_id bigint, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare tid bigint;
begin
  tid := public._tid(p_token);
  if p_id is null then insert into public.classes(name, teacher_id) values (trim(p_name), tid);
  else update public.classes set name = trim(p_name) where id = p_id and teacher_id = tid; end if;
end $$;

create or replace function public.admin_class_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.classes where id = p_id and teacher_id = public._tid(p_token);
end $$;

create or replace function public.admin_pool_save(p_token text, p_id bigint, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare tid bigint;
begin
  tid := public._tid(p_token);
  if p_id is null then insert into public.pools(name, teacher_id) values (trim(p_name), tid);
  else update public.pools set name = trim(p_name) where id = p_id and teacher_id = tid; end if;
end $$;

create or replace function public.admin_pool_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.pools where id = p_id and teacher_id = public._tid(p_token);
end $$;

create or replace function public.admin_students_add(p_token text, p_rows jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb; added int := 0; errs jsonb := '[]'::jsonb; lg text; tid bigint; c bigint; p bigint;
begin
  tid := public._tid(p_token);
  for r in select * from jsonb_array_elements(p_rows) loop
    lg := lower(trim(r->>'login'));
    begin
      c := nullif(r->>'class_id', '')::bigint; p := nullif(r->>'pool_id', '')::bigint;
      if c is not null and not exists (select 1 from public.classes where id = c and teacher_id = tid) then c := null; end if;
      if p is not null and not exists (select 1 from public.pools where id = p and teacher_id = tid) then p := null; end if;
      if char_length(coalesce(r->>'password', '')) < 4 then raise exception 'Parol kamida 4 belgi bo''lishi kerak'; end if;
      if lg !~ '^[a-z0-9_.]{3,30}$' then raise exception 'Login faqat lotin harflari, raqam, _ va . (3-30 belgi)'; end if;
      insert into public.users(role, first_name, last_name, login, pass_hash, class_id, pool_id, teacher_id)
      values ('student', trim(r->>'first_name'), coalesce(trim(r->>'last_name'), ''), lg,
              crypt(r->>'password', gen_salt('bf', 8)), c, p, tid);
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
declare tid bigint;
begin
  tid := public._tid(p_token);
  if p_class is not null and not exists (select 1 from public.classes where id = p_class and teacher_id = tid) then raise exception 'BAD_CLASS'; end if;
  if p_pool is not null and not exists (select 1 from public.pools where id = p_pool and teacher_id = tid) then raise exception 'BAD_POOL'; end if;
  update public.users set first_name = trim(p_first), last_name = coalesce(trim(p_last), ''),
         class_id = p_class, pool_id = p_pool
   where id = p_id and role = 'student' and teacher_id = tid;
end $$;

create or replace function public.admin_set_password(p_token text, p_id bigint, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare tid bigint;
begin
  tid := public._tid(p_token);
  if char_length(coalesce(p_password, '')) < 4 then raise exception 'Parol kamida 4 belgi bo''lishi kerak'; end if;
  update public.users set pass_hash = crypt(p_password, gen_salt('bf', 8)), failed = 0, locked_until = null
   where id = p_id and role = 'student' and teacher_id = tid;
  delete from public.sessions where user_id = p_id and exists (select 1 from public.users where id = p_id and teacher_id = tid);
end $$;

create or replace function public.admin_student_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.users where id = p_id and role = 'student' and teacher_id = public._tid(p_token);
end $$;

create or replace function public.admin_quests_create(p_token text, p_quests jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare r jsonb; ids bigint[] := '{}'; nid bigint; tid bigint; p bigint;
begin
  tid := public._tid(p_token);
  for r in select * from jsonb_array_elements(p_quests) loop
    if jsonb_typeof(r->'steps') <> 'array' then raise exception 'BAD_STEPS'; end if;
    p := nullif(r->>'pool_id', '')::bigint;
    if p is not null and not exists (select 1 from public.pools where id = p and teacher_id = tid) then p := null; end if;
    insert into public.quests(title, pool_id, script, steps, circles, gradable, teacher_id)
    values (r->>'title', p, coalesce(r->>'script', ''), r->'steps', r->'circles',
            (select count(*) from jsonb_array_elements(r->'steps') e where e ? 'a'), tid)
    returning id into nid;
    insert into public.words(quest_id, pool_id, en, uz, ex)
    select nid, p, e->>'en', e->>'uz', coalesce(e->>'ex', '')
    from jsonb_array_elements(r->'steps') e where e->>'t' = 'word';
    ids := ids || nid;
  end loop;
  return json_build_object('ids', ids);
end $$;

create or replace function public.admin_quest_update(p_token text, p_id bigint, p_title text, p_pool bigint,
  p_deadline timestamptz, p_hidden boolean, p_students bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare tid bigint;
begin
  tid := public._tid(p_token);
  if not exists (select 1 from public.quests where id = p_id and teacher_id = tid) then raise exception 'NOT_FOUND'; end if;
  if p_pool is not null and not exists (select 1 from public.pools where id = p_pool and teacher_id = tid) then raise exception 'BAD_POOL'; end if;
  update public.quests set title = trim(p_title), pool_id = p_pool, deadline = p_deadline, hidden = coalesce(p_hidden, false)
   where id = p_id;
  update public.words set pool_id = p_pool where quest_id = p_id;
  if p_students is not null then
    delete from public.quest_students where quest_id = p_id;
    insert into public.quest_students(quest_id, user_id)
      select p_id, s from unnest(p_students) s
      where exists (select 1 from public.users where id = s and role = 'student' and teacher_id = tid);
  end if;
end $$;

create or replace function public.admin_quest_delete(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.quests where id = p_id and teacher_id = public._tid(p_token);
end $$;

create or replace function public.admin_report(p_token text, p_class bigint, p_week date) returns json
language plpgsql security definer set search_path = public as $$
declare d date; tid bigint;
begin
  tid := public._tid(p_token);
  if not exists (select 1 from public.classes where id = p_class and teacher_id = tid) then raise exception 'NOT_FOUND'; end if;
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
declare tid bigint;
begin
  tid := public._tid(p_token);
  return coalesce((
    select json_agg(json_build_object('name', u.first_name || ' ' || u.last_name, 'month', m.month, 'pct', m.pct,
             'seconds', m.seconds, 'answered', m.answered, 'correct', m.correct, 'quests', m.quests)
           order by m.month desc, u.first_name)
    from public.monthly_summary m join public.users u on u.id = m.user_id
    where u.class_id = p_class and u.teacher_id = tid and m.month >= (now() - interval '7 months')::date), '[]'::json);
end $$;

create or replace function public.admin_problems(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare tid bigint;
begin
  tid := public._tid(p_token);
  return coalesce((
    select json_agg(json_build_object('id', r.id, 'quest_id', r.quest_id, 'quest', q.title, 'step', r.step_id,
             'student', coalesce(u.first_name || ' ' || u.last_name, '—'), 'note', r.note, 'at', r.created_at,
             'text', (select coalesce(e->>'q', e->>'uz', concat_ws(' ___ ', e->>'before', e->>'after'), e->>'title')
                      from jsonb_array_elements(q.steps) e where e->>'id' = r.step_id limit 1))
           order by r.created_at desc)
    from public.reports r join public.quests q on q.id = r.quest_id left join public.users u on u.id = r.user_id
    where not r.resolved and q.teacher_id = tid), '[]'::json);
end $$;

create or replace function public.admin_problem_resolve(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.reports set resolved = true
  where id = p_id and quest_id in (select id from public.quests where teacher_id = public._tid(p_token));
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
  public.teacher_me(text),
  public.admin_teachers(text), public.admin_teacher_add(text, text, text, text, text),
  public.admin_teacher_update(text, bigint, text, text, text), public.admin_teacher_password(text, bigint, text),
  public.admin_teacher_delete(text, bigint), public.admin_act_as(text, bigint),
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
