# EduAI Platform (Group 16)

COMP3122 Information Systems Development project Group 16.

This repository contains a Next.js based education platform prototype with:
- course dashboard and subject switching
- virtual teacher chat with AI fallback support
- file upload center (upload, list, rename, delete, summarize)
- course data modules (materials, assignments, grades, FAQs, key points, quizzes)
- project and group management for classroom collaboration
- Clibot Edu interactive activity generator and lab planner

## Repository Structure

- `edu-16-app/`: main Next.js application
- `ENV_SETUP.md`: environment setup and troubleshooting notes
- `PROGRESS.md`: project progress tracker
- `requirements.txt`: legacy Python dependencies from earlier prototype stage
- `package.json` (root): convenience scripts that run the app inside `edu-16-app`

## Tech Stack

- Frontend and Backend: Next.js App Router, React, TypeScript
- Styling and Motion: CSS, Framer Motion
- Interaction and Drag Drop: dnd-kit
- Data and Storage: Supabase (Postgres + Storage)
- AI: OpenAI API (optional, with fallback responses)

## Current Features

### 1. Dashboard
- course overview cards and key metrics
- recent activity feed from uploaded files and course data
- custom feature layout support

### 2. Virtual Teacher
- course aware assistant chat
- uses static course context plus uploaded file excerpts
- logs interactions to FAQ and virtual teacher log tables when available

### 3. Upload Center
- upload files to Supabase bucket `documents`
- list files by `courses/<courseId>/...`
- rename, delete, preview, and summarize files

### 4. Course Data APIs
- materials
- assignments
- assignment related materials
- grades
- FAQs
- key points
- quizzes
- interactive lab planning

### 5. Group Management
- create projects
- create and list groups under project
- group member count and latest chat timestamp support
- local demo fallback behavior when project tables are missing

### 6. Clibot Edu
- generate activities: quiz, matching, ordering, fill-blank, scenario, speed challenge, classification, cause-effect, map-label, memory, debate, team-battle
- activity personalization flow
- optional interactive lab plan generation

## API Endpoints (Current)

### Health
- `GET /api/health`

### Files
- `POST /api/files/upload`
- `GET /api/files/list?courseId=<id>`
- `POST /api/files/rename`
- `POST /api/files/delete`
- `POST /api/files/summary`

### Virtual Teacher
- `POST /api/virtual-teacher/chat`

### Course Data
- `GET /api/courses/[courseId]/materials`
- `GET /api/courses/[courseId]/assignments`
- `GET /api/courses/[courseId]/assignments/[assignmentId]/materials`
- `GET /api/courses/[courseId]/grades`
- `GET /api/courses/[courseId]/faqs`
- `GET /api/courses/[courseId]/keypoints`
- `GET /api/courses/[courseId]/quizzes`
- `POST /api/courses/[courseId]/interactive-labs`

### Projects and Groups
- `GET /api/projects?courseId=<id>`
- `POST /api/projects`
- `GET /api/projects/[projectId]/groups`
- `POST /api/projects/[projectId]/groups`

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (recommended for full feature behavior)
- Optional: OpenAI API key for non-fallback AI responses

## Environment Variables

Create `edu-16-app/.env.local` and configure:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key-optional
```

Notes:
- Server routes use `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- If Supabase values are missing, some pages fall back to empty or local demo data.

## Local Development

From repository root:

```bash
npm install
npm run dev
```

Then open:
- `http://localhost:3000`

Alternative (inside app folder):

```bash
cd edu-16-app
npm install
npm run dev
```

## Build and Run Production Locally

```bash
npm run build
npm run start
```

## Deployment Notes

Vercel deployment is supported.
Use `edu-16-app` as the project root in Vercel and add the same environment variables there.

## User Manual

### A. Admin Manual

Use this role for platform setup, configuration, and operational checks.

1. Configure environment
- create `edu-16-app/.env.local`
- fill Supabase URL, anon key, service role key
- optionally set OpenAI key

2. Start and validate service
- run `npm run dev`
- open `http://localhost:3000`
- call `GET /api/health` and confirm successful JSON response

3. Validate storage setup
- ensure Supabase bucket `documents` exists
- verify files upload under `courses/<courseId>/...`

4. Validate database tables
- apply SQL schema from `edu-16-app/supabase/schema.grouping-chat-ai.sql`
- check project and group APIs return real rows (not fallback)

5. Production deployment checklist
- set Vercel root to `edu-16-app`
- add environment variables in Vercel settings
- run a smoke test on dashboard, file upload, virtual teacher, and project grouping

### B. Instructor Manual

Use this role to prepare course content and manage class activities.

1. Enter Dashboard
- open app homepage
- choose target subject from Available subjects
- review activity feed and overview metrics

2. Manage teaching files
- go to Upload Center
- upload lecture notes or reference documents
- use rename, delete, preview, and summarize actions as needed

3. Use Virtual Teacher
- open Virtual Teacher panel
- ask course specific questions
- verify replies reference course context and uploaded sources when relevant

4. Manage projects and groups
- open Group Management
- create project with group settings (group count and capacity)
- create and review generated groups
- monitor member counts and latest chat status

5. Generate class activities (Clibot Edu)
- enter prompt for desired activity
- choose item count and generate
- run or personalize generated activity for your class
- optionally generate interactive lab plans

### C. Student Manual

Use this role for learning support and self-practice.

1. Select your course
- from dashboard subject cards, select your current course

2. Ask the Virtual Teacher
- open virtual teacher panel
- ask concept questions or assignment structure questions
- read concise guidance and follow-up prompts

3. Review available learning materials
- use course data panels to review materials, assignments, and grades (if published)

4. Participate in project groups
- view assigned project groups (if configured by instructor)
- track group readiness through group and member information shown in the app

5. Practice with interactive activities
- complete quiz or game-like activities generated by instructor
- review your score feedback to identify weak areas

## Known Limitations

- Authentication and role based access control are not fully enforced yet in UI.
- Some modules may run in fallback mode if Supabase tables are unavailable.
- OpenAI responses require valid API key; otherwise fallback response logic is used.

## Maintainers

Group 16, COMP3122 Information Systems Development.
