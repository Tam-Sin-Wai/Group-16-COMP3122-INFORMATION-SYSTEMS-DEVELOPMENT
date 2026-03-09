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


-- ── Row Level Security (RLS) ──────────────────────────────────────────────
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
