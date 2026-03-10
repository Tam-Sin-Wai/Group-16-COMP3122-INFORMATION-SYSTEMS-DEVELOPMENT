-- EduAI MVP schema for project grouping + group chat + @ai mentions

create extension if not exists pgcrypto;

create table if not exists public.courses (
  id text primary key,
  code text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  display_name text not null,
  role text not null check (role in ('teacher', 'student')),
  created_at timestamptz not null default now()
);

create table if not exists public.course_enrollments (
  course_id text not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  name text not null,
  description text,
  target_group_size int not null check (target_group_size > 0),
  max_groups int,
  status text not null default 'draft' check (status in ('draft', 'grouping', 'active', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  capacity int not null check (capacity > 0),
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.project_group_members (
  group_id uuid not null references public.project_groups(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id),
  unique (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.project_groups(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  body text not null,
  message_type text not null default 'user' check (message_type in ('user', 'ai', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_member_presence (
  group_id uuid not null references public.project_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists idx_projects_course_id on public.projects(course_id);
create index if not exists idx_groups_project_id on public.project_groups(project_id);
create index if not exists idx_group_members_group_id on public.project_group_members(group_id);
create index if not exists idx_group_messages_group_created on public.group_messages(group_id, created_at desc);
create index if not exists idx_group_presence_last_seen on public.group_member_presence(group_id, last_seen_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

-- Optional RLS starter rules (tighten for production auth model)
alter table public.projects enable row level security;
alter table public.project_groups enable row level security;
alter table public.project_group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_member_presence enable row level security;

-- Example permissive policy for service role-based API usage.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'service_all_projects'
  ) then
    create policy service_all_projects on public.projects for all using (true) with check (true);
  end if;
end$$;
