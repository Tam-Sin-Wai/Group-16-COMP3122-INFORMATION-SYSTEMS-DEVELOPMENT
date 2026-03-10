-- ============================================================
-- EduAI – GenAI Learning Platform
-- Supabase (PostgreSQL) Schema
-- Run this in your Supabase SQL Editor to set up the database.
-- ============================================================

-- ── Enable UUID extension ─────────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ── courses ───────────────────────────────────────────────────────────────
create table if not exists courses (
    id          uuid primary key default gen_random_uuid(),
    code        text not null,
    name        text not null,
    description text,
    created_at  timestamptz default now()
);

-- Seed with example courses
insert into courses (code, name, description) values
  ('COMP3122', 'Information Systems Development',
   'A course on developing modern information systems using contemporary technologies and methodologies.'),
  ('COMP3201', 'Artificial Intelligence',
   'Foundations of AI including machine learning, neural networks, and intelligent agents.'),
  ('COMP3301', 'Database Management Systems',
   'Design, implementation, and management of relational and NoSQL databases.')
on conflict do nothing;


-- ── course_materials ──────────────────────────────────────────────────────
-- type: 'lecture_notes' | 'transcript' | 'assignment' | 'padlet'
create table if not exists course_materials (
    id         uuid primary key default gen_random_uuid(),
    course_id  uuid references courses(id) on delete cascade,
    type       text not null check (type in ('lecture_notes', 'transcript', 'assignment', 'padlet')),
    title      text not null,
    content    text not null,
    created_at timestamptz default now()
);

create index if not exists idx_course_materials_course_id on course_materials(course_id);


-- ── chat_history ──────────────────────────────────────────────────────────
-- Stores conversation history per session (optional, for analytics).
create table if not exists chat_history (
    id         uuid primary key default gen_random_uuid(),
    session_id text not null,
    course_id  uuid references courses(id) on delete set null,
    role       text not null check (role in ('user', 'assistant')),
    content    text not null,
    created_at timestamptz default now()
);

create index if not exists idx_chat_history_session on chat_history(session_id);
create index if not exists idx_chat_history_course  on chat_history(course_id);


-- ── study_groups ──────────────────────────────────────────────────────────────
-- Teachers create groups per course/assignment; students are assigned to them.
create table if not exists study_groups (
    id          uuid primary key default gen_random_uuid(),
    course_id   uuid references courses(id) on delete cascade,
    name        text not null,
    project     text not null,
    created_by  text,                     -- teacher identifier (email or user id)
    status      text not null default 'active' check (status in ('active', 'archived')),
    created_at  timestamptz default now()
);

create index if not exists idx_study_groups_course_id on study_groups(course_id);


-- ── group_members ─────────────────────────────────────────────────────────────
-- Tracks which students belong to each group and their last-online timestamp.
create table if not exists group_members (
    id           uuid primary key default gen_random_uuid(),
    group_id     uuid references study_groups(id) on delete cascade,
    user_id      text not null,            -- student identifier
    display_name text not null,
    avatar_code  text not null,            -- two-letter abbreviation, e.g. "AC"
    role         text not null default 'member' check (role in ('leader', 'member')),
    last_online  timestamptz default now(),
    joined_at    timestamptz default now(),
    unique (group_id, user_id)
);

create index if not exists idx_group_members_group_id on group_members(group_id);


-- ── group_messages ─────────────────────────────────────────────────────────────
-- Stores chat messages for each study group, including AI replies.
create table if not exists group_messages (
    id         uuid primary key default gen_random_uuid(),
    group_id   uuid references study_groups(id) on delete cascade,
    sender_id  text,                       -- null for AI messages
    sender_name text not null,
    avatar_code text not null default 'AI',
    role       text not null default 'member',
    text       text not null,
    is_ai      boolean not null default false,
    created_at timestamptz default now()
);

create index if not exists idx_group_messages_group_id on group_messages(group_id);
create index if not exists idx_group_messages_created  on group_messages(group_id, created_at);


-- ── Row Level Security for new tables ─────────────────────────────────────────
-- NOTE: The policies below are intentionally permissive for development.
-- Once authentication is implemented (see PROGRESS.md – Developer 1),
-- replace `using (true)` with membership checks, e.g.:
--   using (id in (select group_id from group_members where user_id = auth.uid()::text))
alter table study_groups   enable row level security;
alter table group_members  enable row level security;
alter table group_messages enable row level security;

-- Allow authenticated users to read groups they belong to (adjust to your auth strategy)
create policy "Members can read their groups"
    on study_groups for select using (true);

create policy "Members can read group members"
    on group_members for select using (true);

create policy "Members can read group messages"
    on group_messages for select using (true);

create policy "Members can insert group messages"
    on group_messages for insert with check (true);
-- Enable RLS on all tables. Adjust policies to fit your auth strategy.

alter table courses          enable row level security;
alter table course_materials enable row level security;
alter table chat_history     enable row level security;

-- Allow public (anon) read access to courses and materials.
-- Adjust these policies when you add authentication.
create policy "Public read courses"
    on courses for select using (true);

create policy "Public read course_materials"
    on course_materials for select using (true);

-- Allow authenticated users to insert chat history (optional).
create policy "Allow insert chat_history"
    on chat_history for insert with check (true);
