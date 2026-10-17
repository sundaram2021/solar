-- Solar full schema (consolidated).
--
-- This single migration is the source of truth for a Solar workspace. It is
-- idempotent and safe to run against a fresh or existing Solar
-- database: it creates what is missing, drops the retired memory + evaluator
-- surfaces, and adds the Armoriq intent-guardrail tables.
--
-- Run in the Supabase SQL editor (or hand it to the Supabase agent).

-- ============================================================================
-- 0) Legacy cleanup: the shared-memory + evaluator systems are retired.
-- ============================================================================
drop policy if exists via_agent on public.evaluations;
drop table if exists public.evaluations cascade;
drop table if exists public.agent_templates cascade;
drop table if exists public.skill_library cascade;

-- ============================================================================
-- 1) GitHub OAuth token per user (server-side actions on the user's behalf)
-- ============================================================================
create table if not exists public.github_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_token text not null,
  github_username text,
  scopes text not null default 'repo workflow read:org user:email',
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2) Polled GitHub events (deduped intake queue)
-- ============================================================================
create table if not exists public.github_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id text not null,
  type text not null,
  repo text not null default '',
  number int,
  title text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received','proposed','running','done','ignored')),
  created_at timestamptz not null default now(),
  unique (user_id, delivery_id)
);
create index if not exists github_events_user_status_idx
  on public.github_events (user_id, status, created_at desc);

-- ============================================================================
-- 3) Sub-agents spawned by the orchestrator
--    Statuses include 'blocked' for Armoriq intent-guardrail stops.
-- ============================================================================
create table if not exists public.sub_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.github_events(id) on delete set null,
  kind text not null default 'custom'
    check (kind in ('implementation','review','testing','custom')),
  title text not null default '',
  system_prompt text not null default '',
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval','running','completed','failed','blocked')),
  sandbox_id text,
  trace_id text,
  run_log text not null default '',
  steering text not null default '',
  result jsonb not null default '{}'::jsonb,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sub_agents_user_status_idx
  on public.sub_agents (user_id, status, created_at desc);
-- Repair columns on databases created by an older migration.
alter table public.sub_agents add column if not exists run_log text not null default '';
alter table public.sub_agents add column if not exists steering text not null default '';
alter table public.sub_agents add column if not exists result jsonb not null default '{}'::jsonb;
alter table public.sub_agents add column if not exists blocked_reason text;
alter table public.sub_agents add column if not exists updated_at timestamptz not null default now();
alter table public.sub_agents drop column if exists skills;
alter table public.sub_agents drop column if exists skill_definitions;
alter table public.sub_agents drop column if exists eval_score;
alter table public.sub_agents drop constraint if exists sub_agents_status_check;
alter table public.sub_agents
  add constraint sub_agents_status_check
  check (status in ('awaiting_approval','running','completed','failed','blocked'));

-- Legacy task tables (may predate this schema) — link runs defensively.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default '',
  description text default '',
  repo_name text default '',
  kind text default 'custom',
  issue_number int,
  pr_number int,
  assigned_agent text default '',
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks
  add column if not exists sub_agent_id uuid references public.sub_agents(id) on delete set null;

create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text not null default '',
  html_url text default '',
  private boolean not null default false,
  is_active boolean not null default true,
  branch text default 'main',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 4) Chat threads (one orchestrator thread per user)
-- ============================================================================
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'orchestrator' check (kind = 'orchestrator'),
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx
  on public.chat_messages (thread_id, created_at asc);
alter table public.chat_messages add column if not exists steps jsonb not null default '[]'::jsonb;

-- ============================================================================
-- 5) Approval gates (agent runs, publishing, merges, destructive GitHub ops)
-- ============================================================================
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null
    check (kind in ('run_agent','publish_pr','merge','github_comment','close_issue','close_pr')),
  ref_id text not null default '',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','executing','failed')),
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists approvals_user_status_idx
  on public.approvals (user_id, status, created_at desc);
alter table public.approvals add column if not exists steps jsonb not null default '[]'::jsonb;
alter table public.approvals drop constraint if exists approvals_kind_check;
alter table public.approvals
  add constraint approvals_kind_check
  check (kind in ('run_agent','publish_pr','merge','github_comment','close_issue','close_pr'));
alter table public.approvals drop constraint if exists approvals_status_check;
alter table public.approvals
  add constraint approvals_status_check
  check (status in ('pending','approved','rejected','executing','failed'));

-- ============================================================================
-- 6) Per-user automation settings
-- ============================================================================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  orchestrator_auto_approve boolean not null default false
);
alter table public.user_settings drop column if exists evaluator_auto_apply;

-- ============================================================================
-- 7) Activity feed (notifications bell, toasts, Activity view)
-- ============================================================================
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  type text not null default 'event'
    check (type in ('pr','sparkles','brain','issue','event','security')),
  created_at timestamptz not null default now()
);
create index if not exists activities_user_created_idx
  on public.activities (user_id, created_at desc);
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities
  add constraint activities_type_check
  check (type in ('pr','sparkles','brain','issue','event','security'));

-- ============================================================================
-- 8) Armoriq intent guardrails: the approved plan per run + any violations
-- ============================================================================
create table if not exists public.intent_plans (
  id uuid primary key default gen_random_uuid(),
  sub_agent_id uuid not null references public.sub_agents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null default '',
  allowed_tools text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active','closed','violated')),
  created_at timestamptz not null default now()
);
create index if not exists intent_plans_agent_idx
  on public.intent_plans (sub_agent_id, created_at desc);

create table if not exists public.intent_violations (
  id uuid primary key default gen_random_uuid(),
  sub_agent_id uuid not null references public.sub_agents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null default '',
  reason text not null default '',
  args_preview text,
  created_at timestamptz not null default now()
);
create index if not exists intent_violations_agent_idx
  on public.intent_violations (sub_agent_id, created_at desc);

-- ============================================================================
-- 9) Row Level Security: users only see their own rows
-- ============================================================================
alter table public.github_connections enable row level security;
alter table public.github_events enable row level security;
alter table public.sub_agents enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.approvals enable row level security;
alter table public.user_settings enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.repositories enable row level security;
alter table public.intent_plans enable row level security;
alter table public.intent_violations enable row level security;

-- Owner-only policy for tables keyed directly by user_id.
do $$
declare t text;
begin
  foreach t in array array[
    'github_connections','github_events','sub_agents','chat_threads',
    'approvals','user_settings','activities','tasks','repositories','intent_plans'
  ] loop
    execute format(
      'drop policy if exists owner_all on public.%I; create policy owner_all on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t);
  end loop;
end $$;

-- chat_messages: access via the owning thread.
drop policy if exists via_thread on public.chat_messages;
create policy via_thread on public.chat_messages for all
  using (exists (
    select 1 from public.chat_threads th
    where th.id = chat_messages.thread_id and th.user_id = auth.uid()))
  with check (exists (
    select 1 from public.chat_threads th
    where th.id = chat_messages.thread_id and th.user_id = auth.uid()));

-- intent_violations: access via the owning sub-agent.
drop policy if exists via_agent on public.intent_violations;
create policy via_agent on public.intent_violations for all
  using (exists (
    select 1 from public.sub_agents sa
    where sa.id = intent_violations.sub_agent_id and sa.user_id = auth.uid()))
  with check (exists (
    select 1 from public.sub_agents sa
    where sa.id = intent_violations.sub_agent_id and sa.user_id = auth.uid()));

-- ============================================================================
-- 10) updated_at maintenance: keep the column fresh so the reaper can tell a
--     genuinely stuck run (no progress for 40min) from a healthy long run.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists sub_agents_set_updated_at on public.sub_agents;
create trigger sub_agents_set_updated_at
  before update on public.sub_agents
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 11) Realtime: publish the tables the dashboard subscribes to.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['sub_agents','approvals','github_events','activities','intent_violations'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
