-- Stage 2-3 tables: word bank, spaced review, practice, trophies, mistake reports, castle, monthly summaries.

alter table public.answers alter column quest_id drop not null;
alter table public.answers add column if not exists kind text not null default 'quest'
  check (kind in ('quest', 'review', 'practice'));

create table if not exists public.words (
  id bigint generated always as identity primary key,
  quest_id bigint references public.quests(id) on delete set null,
  pool_id bigint references public.pools(id) on delete set null,
  en text not null, uz text not null, ex text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists words_quest_idx on public.words(quest_id);
create index if not exists words_pool_idx on public.words(pool_id);

create table if not exists public.word_review (
  user_id bigint not null references public.users(id) on delete cascade,
  word_id bigint not null references public.words(id) on delete cascade,
  box int not null default 1,
  due timestamptz not null,
  primary key (user_id, word_id)
);

create table if not exists public.review_slots (
  user_id bigint not null references public.users(id) on delete cascade,
  quest_id bigint not null references public.quests(id) on delete cascade,
  slot text not null,
  kind text not null,
  word_id bigint references public.words(id) on delete set null,
  ref_quest bigint, ref_step text,
  q text, opts jsonb, ans text, hint text,
  primary key (user_id, quest_id, slot)
);

create table if not exists public.practice (
  user_id bigint primary key references public.users(id) on delete cascade,
  kind text not null,
  word_id bigint, ref_quest bigint, ref_step text, ans text,
  served_at timestamptz not null default now()
);

create table if not exists public.trophies (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  kind text not null,
  week_start date not null default '1970-01-01',
  class_id bigint,
  created_at timestamptz not null default now(),
  unique (user_id, kind, week_start)
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  user_id bigint references public.users(id) on delete set null,
  quest_id bigint not null references public.quests(id) on delete cascade,
  step_id text not null,
  note text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.castle (
  user_id bigint primary key references public.users(id) on delete cascade,
  earned int not null default 0,
  spent int not null default 0,
  defense int not null default 1,
  loot int not null default 50
);

create table if not exists public.attacks (
  id bigint generated always as identity primary key,
  attacker bigint not null references public.users(id) on delete cascade,
  defender bigint not null references public.users(id) on delete cascade,
  win boolean not null,
  loot int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists attacks_attacker_idx on public.attacks(attacker, created_at);
create index if not exists attacks_defender_idx on public.attacks(defender, created_at);

create table if not exists public.monthly_summary (
  user_id bigint not null references public.users(id) on delete cascade,
  month date not null,
  class_id bigint,
  quests int not null default 0,
  pct int,
  seconds int not null default 0,
  answered int not null default 0,
  correct int not null default 0,
  primary key (user_id, month)
);

create table if not exists public.meta (key text primary key, value text not null);

alter table public.words enable row level security;
alter table public.word_review enable row level security;
alter table public.review_slots enable row level security;
alter table public.practice enable row level security;
alter table public.trophies enable row level security;
alter table public.reports enable row level security;
alter table public.castle enable row level security;
alter table public.attacks enable row level security;
alter table public.monthly_summary enable row level security;
alter table public.meta enable row level security;
revoke all on all tables in schema public from anon, authenticated;

-- word bank for quests that already exist
insert into public.words(quest_id, pool_id, en, uz, ex)
select q.id, q.pool_id, e->>'en', e->>'uz', coalesce(e->>'ex', '')
from public.quests q, jsonb_array_elements(q.steps) e
where e->>'t' = 'word' and not exists (select 1 from public.words w where w.quest_id = q.id);
