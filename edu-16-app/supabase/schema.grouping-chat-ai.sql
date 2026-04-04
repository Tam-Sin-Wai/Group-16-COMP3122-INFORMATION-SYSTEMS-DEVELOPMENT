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
  role text not null check (role in ('teacher','student')),
  created_at timestamptz not null default now()
);

create table if not exists public.course_enrollments (
  course_id text not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('teacher','student')),
  created_at timestamptz not null default now(),
  primary key (course_id,user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  name text not null,
  description text,
  target_group_size int not null check (target_group_size > 0),
  max_groups int,
  status text not null default 'draft'
    check (status in ('draft','grouping','active','archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.project_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  capacity int not null,
  created_at timestamptz default now(),
  unique(project_id,name)
);

create table if not exists public.project_group_members (
  group_id uuid not null references public.project_groups(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key(project_id,user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.project_groups(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  body text not null,
  message_type text not null default 'user'
    check (message_type in ('user','ai','system')),
  created_at timestamptz default now()
);

create table if not exists public.group_member_presence (
  group_id uuid not null references public.project_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_seen_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key(group_id,user_id)
);

create table if not exists public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  type text not null
    check (type in ('lecture_summary','transcript','assignment_guideline','padlet','other')),
  description text,
  url text,
  file_path text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz not null,
  max_marks int default 100,
  status text not null default 'active'
    check (status in ('draft','active','archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.assignments(id),
  marks_obtained int,
  max_marks int default 100,
  percentage numeric(5,2),
  feedback text,
  graded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id,assignment_id)
);

-- New tables for enhanced features
create table if not exists public.assignment_materials (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  material_id uuid not null references public.course_materials(id) on delete cascade,
  relevance_score int default 5 check (relevance_score between 1 and 10),
  created_at timestamptz default now(),
  primary key (assignment_id, material_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'practice' check (type in ('practice','exam','revision')),
  questions jsonb not null, -- Array of question objects
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null, -- User's answers
  score int,
  max_score int,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(quiz_id, user_id)
);

create table if not exists public.frequently_asked_questions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  question text not null,
  answer text,
  frequency int default 1,
  last_asked timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(course_id, question)
);

create table if not exists public.virtual_teacher_logs (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  user_id uuid references public.profiles(id),
  question text not null,
  response text,
  response_source text default 'openai' check (response_source in ('openai','fallback')),
  created_at timestamptz default now()
);

insert into public.profiles (id,email,display_name,role) values
('550e8400-e29b-41d4-a716-446655440001','teacher1@eduai.com','Dr Smith','teacher'),
('550e8400-e29b-41d4-a716-446655440002','teacher2@eduai.com','Prof Johnson','teacher'),
('550e8400-e29b-41d4-a716-446655440003','teacher3@eduai.com','Dr Lee','teacher'),

('550e8400-e29b-41d4-a716-446655440101','student1@eduai.com','Alice','student'),
('550e8400-e29b-41d4-a716-446655440102','student2@eduai.com','Bob','student'),
('550e8400-e29b-41d4-a716-446655440103','student3@eduai.com','Charlie','student')
on conflict do nothing;

insert into public.courses (id,code,name) values
('comp3122','COMP3122','Information Systems Development'),
('comp4107','COMP4107','Human Computer Interaction'),
('comp2202','COMP2202','Database Systems')
on conflict do nothing;

insert into public.course_materials (course_id,title,type,description,file_path) values
('comp3122','System Design Fundamentals','lecture_summary',
 'Intro to system architecture and stakeholder analysis',
 'materials/comp3122/week1.pdf'),

('comp4107','User Centered Design','lecture_summary',
 'Introduction to usability principles and personas',
 'materials/comp4107/week1.pdf'),

('comp2202','Database Normalization','lecture_summary',
 'Overview of ER modeling and 3NF normalization',
 'materials/comp2202/week1.pdf')
on conflict do nothing;

insert into public.assignments
(course_id,title,description,due_date,created_by)
values

('comp3122',
 'System Design Report',
 'Write a full system design proposal',
 '2026-04-15',
 '550e8400-e29b-41d4-a716-446655440001'),

('comp4107',
 'User Research Report',
 'Interview users and create personas',
 '2026-04-10',
 '550e8400-e29b-41d4-a716-446655440002'),

('comp2202',
 'Database Design Assignment',
 'Design normalized relational schema',
 '2026-04-12',
 '550e8400-e29b-41d4-a716-446655440003')
on conflict do nothing;

insert into public.grades
(course_id,user_id,assignment_id,marks_obtained,max_marks,percentage,feedback,graded_by)
values

('comp3122',
'550e8400-e29b-41d4-a716-446655440101',
(SELECT id FROM assignments WHERE title='System Design Report'),
88,100,88,'Excellent system architecture',
'550e8400-e29b-41d4-a716-446655440001'),

('comp2202',
'550e8400-e29b-41d4-a716-446655440102',
(SELECT id FROM assignments WHERE title='Database Design Assignment'),
75,100,75,'Normalization mostly correct',
'550e8400-e29b-41d4-a716-446655440003');