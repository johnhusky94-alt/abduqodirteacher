-- Abduqodir Teacher: database schema (stage 1)
-- All access goes through SECURITY DEFINER functions; tables are closed to the public API.

drop function if exists public.connection_test_count();
drop table if exists public.connection_tests;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.classes (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.pools (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id bigint generated always as identity primary key,
  role text not null check (role in ('teacher','student')),
  first_name text not null check (char_length(first_name) between 1 and 40),
  last_name text not null default '' check (char_length(last_name) <= 40),
  login text not null unique check (login ~ '^[a-z0-9_.]{3,30}$'),
  pass_hash text not null,
  class_id bigint references public.classes(id) on delete set null,
  pool_id bigint references public.pools(id) on delete set null,
  failed int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  token text primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions(user_id);

create table if not exists public.quests (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 120),
  pool_id bigint references public.pools(id) on delete set null,
  deadline timestamptz,
  hidden boolean not null default false,
  script text not null default '',
  steps jsonb not null,
  circles jsonb not null,
  gradable int not null check (gradable > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.quest_students (
  quest_id bigint not null references public.quests(id) on delete cascade,
  user_id bigint not null references public.users(id) on delete cascade,
  primary key (quest_id, user_id)
);
create index if not exists quest_students_user_idx on public.quest_students(user_id);

create table if not exists public.progress (
  user_id bigint not null references public.users(id) on delete cascade,
  quest_id bigint not null references public.quests(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  done int not null default 0,
  correct int not null default 0,
  answered int not null default 0,
  ms bigint not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);
create index if not exists progress_quest_idx on public.progress(quest_id);

create table if not exists public.answers (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  quest_id bigint not null references public.quests(id) on delete cascade,
  step_id text not null,
  ok boolean,            -- null = a card (reading time only)
  ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists answers_user_time_idx on public.answers(user_id, created_at);
create index if not exists answers_user_quest_idx on public.answers(user_id, quest_id);

alter table public.classes enable row level security;
alter table public.pools enable row level security;
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.quests enable row level security;
alter table public.quest_students enable row level security;
alter table public.progress enable row level security;
alter table public.answers enable row level security;

revoke all on all tables in schema public from anon, authenticated;
