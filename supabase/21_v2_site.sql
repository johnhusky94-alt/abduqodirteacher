-- Abduqodir Teacher V2 ("Ingliz tili V2"): new tables and API, added NEXT TO the old ones.
-- Nothing here changes or deletes old tables. Logins stay in public.users / public.sessions,
-- checked by the old public.login() function, so every account keeps its login and password.

-- ---------- tables ----------
-- one row per V2 person (student or teacher), tied to an existing account
create table if not exists public.v2_person (
  id         text primary key,                       -- 'u12' for students, 't1' for teachers, or a new id
  user_id    bigint not null unique references public.users(id) on delete cascade,
  cls        text,                                   -- V2 class id (students)
  grp        text,                                   -- V2 group name (students)
  removed    boolean not null default false,
  created_at timestamptz not null default now()
);

-- teacher-written content and small shared records: classes, works, plans, groups, settings,
-- overrides, accept, writings, reports. One JSON document per (collection, id).
create table if not exists public.v2_doc (
  coll       text not null,
  id         text not null,
  data       jsonb not null,
  sid        text,                                   -- owner student (writings, reports)
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);
create index if not exists v2_doc_sid on public.v2_doc (coll, sid);

-- the append-only event log (every answer, finish, game, gold)
create table if not exists public.v2_events (
  id         text primary key,
  sid        text not null references public.v2_person(id) on delete cascade,
  ts         bigint not null,
  kind       text not null,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists v2_events_sid_ts on public.v2_events (sid, ts);
create index if not exists v2_events_ts on public.v2_events (ts);

-- castle state, one row per student
create table if not exists public.v2_castle (
  sid        text primary key references public.v2_person(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.v2_person enable row level security;
alter table public.v2_doc    enable row level security;
alter table public.v2_events enable row level security;
alter table public.v2_castle enable row level security;
revoke all on public.v2_person, public.v2_doc, public.v2_events, public.v2_castle from anon, authenticated;

-- ---------- helpers (not callable from the website) ----------
create or replace function public._v2_name(u public.users) returns text
language sql immutable as $$ select trim(u.first_name || ' ' || coalesce(u.last_name, '')) $$;

-- the V2 person of an account; created on first use (accounts added in the old site later)
create or replace function public._v2_person(u public.users) returns public.v2_person
language plpgsql security definer set search_path = public as $$
declare p public.v2_person; g text;
begin
  select * into p from public.v2_person where user_id = u.id;
  if found then return p; end if;
  select name into g from public.pools where id = u.pool_id;
  insert into public.v2_person (id, user_id, cls, grp)
    values (case when u.role = 'teacher' then 't' else 'u' end || u.id, u.id,
            case when u.role = 'student' and u.class_id is not null then 'c' || u.class_id end,
            case when u.role = 'student' then g end)
    returning * into p;
  return p;
end $$;

-- split "First Last Name" into the two columns of public.users
create or replace function public._v2_split(p_name text, out f text, out l text)
language plpgsql immutable as $$
declare n text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if position(' ' in n) > 0 then f := split_part(n, ' ', 1); l := substr(n, length(f) + 2);
  else f := n; l := ''; end if;
  f := left(f, 40); l := left(l, 40);
  if f = '' then raise exception 'NAME'; end if;
end $$;

-- ---------- boot: everything the page needs, in the V2 database shape ----------
create or replace function public.v2_boot(p_token text, p_days int default 42) returns json
language plpgsql security definer set search_path = public as $$
declare
  u public.users; me public.v2_person; tch boolean; adm boolean;
  since bigint; mates_since bigint; res json;
begin
  u := public._auth(p_token);
  me := public._v2_person(u);
  if me.removed then return json_build_object('error', 'REMOVED'); end if;
  tch := u.role = 'teacher'; adm := tch and u.is_admin;
  since := (extract(epoch from now() - make_interval(days => greatest(coalesce(p_days, 42), 7))) * 1000)::bigint;
  mates_since := (extract(epoch from now() - interval '15 days') * 1000)::bigint;

  select json_build_object(
    'me', json_build_object('id', me.id, 'role', u.role, 'admin', adm, 'name', public._v2_name(u), 'login', u.login),
    'now', (extract(epoch from now()) * 1000)::bigint,
    'since', case when tch then since end,
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
      'events', coalesce((select json_agg(e.data order by e.ts) from public.v2_events e
                    where (tch and e.ts >= since)
                       or (not tch and (e.sid = me.id
                            or (e.ts >= mates_since and e.sid in (select id from public.v2_person where cls = me.cls and not removed))))), '[]')
    ),
    'castles', coalesce((select json_object_agg(c.sid, c.state) from public.v2_castle c
                  where tch or c.sid in (select id from public.v2_person where cls = me.cls and not removed)), '{}')
  ) into res;
  return res;
end $$;

-- older events of one student (teacher pages that look further back than the boot window)
create or replace function public.v2_events_of(p_token text, p_sid text, p_before bigint) returns json
language plpgsql security definer set search_path = public as $$
declare u public.users; me public.v2_person;
begin
  u := public._auth(p_token); me := public._v2_person(u);
  if u.role <> 'teacher' and p_sid <> me.id then raise exception 'FORBIDDEN'; end if;
  return coalesce((select json_agg(e.data order by e.ts) from public.v2_events e where e.sid = p_sid and e.ts < p_before), '[]');
end $$;

-- ---------- sync: new events, changed documents and accounts, castles ----------
create or replace function public.v2_sync(p_token text, p_events jsonb default '[]', p_ops jsonb default '[]', p_castles jsonb default '{}')
returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  u public.users; me public.v2_person; tch boolean; adm boolean;
  e jsonb; op jsonb; c text; k text; dat jsonb; old public.v2_doc;
  errs jsonb := '[]'; nev int := 0; nops int := 0;
  p public.v2_person; x public.users; nm record; lg text; uid2 bigint; st jsonb;
begin
  u := public._auth(p_token);
  me := public._v2_person(u);
  if me.removed then raise exception 'REMOVED'; end if;
  tch := u.role = 'teacher'; adm := tch and u.is_admin;

  -- events: a student writes only their own; a teacher may write for any student
  for e in select * from jsonb_array_elements(coalesce(p_events, '[]')) loop
    if (e->>'id') is null or (e->>'sid') is null or (e->>'kind') is null then continue; end if;
    if not tch and e->>'sid' <> me.id then continue; end if;
    if not exists (select 1 from public.v2_person where id = e->>'sid') then continue; end if;
    insert into public.v2_events (id, sid, ts, kind, data)
      values (e->>'id', e->>'sid', coalesce((e->>'ts')::bigint, (extract(epoch from now()) * 1000)::bigint), e->>'kind', e)
      on conflict (id) do nothing;
    nev := nev + 1;
  end loop;

  -- documents and accounts
  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]')) loop
    c := op->>'coll'; k := op->>'id'; dat := op->'data';
    if dat = 'null'::jsonb then dat := null; end if;
    begin
      if c in ('classes', 'works', 'plans', 'overrides', 'accept', 'groups', 'settings') then
        if not tch then raise exception 'FORBIDDEN'; end if;
        if dat is null then delete from public.v2_doc where coll = c and id = k;
        else
          if c = 'settings' then dat := dat - 'clock'; end if;   -- the test clock stays in one browser
          insert into public.v2_doc (coll, id, data) values (c, k, dat)
            on conflict (coll, id) do update set data = excluded.data, updated_at = now();
        end if;

      elsif c in ('writings', 'reports') then
        select * into old from public.v2_doc where coll = c and id = k;
        if not tch then
          if dat is null then raise exception 'FORBIDDEN'; end if;
          if dat->>'sid' is distinct from me.id or (old.id is not null and old.sid is distinct from me.id) then raise exception 'FORBIDDEN'; end if;
          -- marks, feedback and status belong to the teacher
          if old.id is not null then
            dat := dat || jsonb_build_object('status', old.data->'status', 'fb', old.data->'fb');
          else
            dat := dat || jsonb_build_object('status', 'new');
            if c = 'writings' then dat := dat || jsonb_build_object('fb', null); end if;
          end if;
        end if;
        if dat is null then delete from public.v2_doc where coll = c and id = k;
        else
          insert into public.v2_doc (coll, id, data, sid) values (c, k, dat, dat->>'sid')
            on conflict (coll, id) do update set data = excluded.data, sid = excluded.sid, updated_at = now();
        end if;

      elsif c in ('students', 'teachers') then
        if not tch then raise exception 'FORBIDDEN'; end if;
        if c = 'teachers' and not adm and k <> me.id then raise exception 'FORBIDDEN'; end if;
        select * into p from public.v2_person where id = k;
        if dat is null then
          -- remove: the person leaves V2 and cannot log in any more; history stays
          if p.id is null then continue; end if;
          if p.user_id = u.id then raise exception 'SELF'; end if;
          update public.v2_person set removed = true where id = k;
          update public.users set pass_hash = crypt(encode(gen_random_bytes(18), 'hex'), gen_salt('bf')) where id = p.user_id;
          delete from public.sessions where user_id = p.user_id;
        else
          nm := public._v2_split(dat->>'name');
          lg := lower(trim(coalesce(dat->>'login', '')));
          if lg !~ '^[a-z0-9_.]{3,30}$' then raise exception 'LOGIN_FORMAT'; end if;
          if p.id is null then
            -- a new account, or a removed one coming back under the same login
            select * into x from public.users where login = lg;
            if x.id is not null then
              if not exists (select 1 from public.v2_person where user_id = x.id and removed) then raise exception 'LOGIN_TAKEN'; end if;
              if x.role <> (case when c = 'students' then 'student' else 'teacher' end) then raise exception 'LOGIN_TAKEN'; end if;
              delete from public.v2_person where user_id = x.id;
              uid2 := x.id;
            else
              if coalesce(dat->>'pass', '') = '' then raise exception 'PASSWORD'; end if;
              insert into public.users (role, first_name, last_name, login, pass_hash, teacher_id, is_admin)
                values (case when c = 'students' then 'student' else 'teacher' end, nm.f, nm.l, lg,
                        crypt(dat->>'pass', gen_salt('bf')), case when c = 'students' then u.id end, false)
                returning id into uid2;
            end if;
            insert into public.v2_person (id, user_id, cls, grp)
              values (k, uid2, case when c = 'students' then dat->>'cls' end, case when c = 'students' then dat->>'group' end);
            select * into p from public.v2_person where id = k;
          end if;
          if exists (select 1 from public.users where login = lg and id <> p.user_id) then raise exception 'LOGIN_TAKEN'; end if;
          update public.users set first_name = nm.f, last_name = nm.l, login = lg where id = p.user_id;
          if coalesce(dat->>'pass', '') <> '' then
            update public.users set pass_hash = crypt(dat->>'pass', gen_salt('bf')), failed = 0, locked_until = null where id = p.user_id;
          end if;
          if c = 'students' then update public.v2_person set cls = dat->>'cls', grp = dat->>'group' where id = k; end if;
        end if;
      end if;
      nops := nops + 1;
    exception when others then
      errs := errs || jsonb_build_array(jsonb_build_object('coll', c, 'id', k, 'error', sqlerrm));
    end;
  end loop;

  -- castles
  for k, st in select * from jsonb_each(coalesce(p_castles, '{}')) loop
    if not exists (select 1 from public.v2_person where id = k) then continue; end if;
    if not tch and k <> me.id then
      -- a raid: a classmate may only put this castle to rest (lock), for at most 6 minutes
      if not exists (select 1 from public.v2_person where id = k and cls = me.cls) then continue; end if;
      update public.v2_castle set state = jsonb_set(state, '{lock}', to_jsonb(least(
               coalesce((st->>'lock')::bigint, 0), (extract(epoch from now() + interval '6 minutes') * 1000)::bigint))),
             updated_at = now()
       where sid = k and coalesce((state->>'lock')::bigint, 0) < coalesce((st->>'lock')::bigint, 0);
      continue;
    end if;
    -- the owner's own save never clears a rest a classmate's raid has just set
    insert into public.v2_castle (sid, state) values (k, st)
      on conflict (sid) do update set
        state = excluded.state || jsonb_build_object('lock', greatest(coalesce((public.v2_castle.state->>'lock')::bigint, 0), coalesce((excluded.state->>'lock')::bigint, 0))),
        updated_at = now();
  end loop;

  return json_build_object('ok', true, 'events', nev, 'ops', nops, 'errors', errs);
end $$;

revoke all on function public._v2_name(public.users), public._v2_person(public.users), public._v2_split(text) from public, anon, authenticated;
revoke all on function public.v2_boot(text, int), public.v2_events_of(text, text, bigint), public.v2_sync(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.v2_boot(text, int), public.v2_events_of(text, text, bigint), public.v2_sync(text, jsonb, jsonb, jsonb) to anon, authenticated;
