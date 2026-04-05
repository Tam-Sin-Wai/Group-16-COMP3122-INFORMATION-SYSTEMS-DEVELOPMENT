# EduAI Next.js App

Course-aware learning platform prototype with GenAI virtual teacher and file upload center.

## Current Features

- Course-aware Virtual Teacher chat that answers using the selected course context
- Upload Center for managing course knowledge base files
- File list, preview, rename, delete, and one-click summary actions
- Placeholder sections for upcoming modules such as Assignments, Padlet Insights, and Study Group Hub
- Clibot Edu, a teacher activity generator with multiple test and game modes

## Clibot Edu Generation Modes

Clibot Edu can generate the following activity types from teacher prompts:

- `quiz` for multiple-choice question sets
- `matching` for term-definition matching
- `ordering` for sequence or timeline arrangement
- `fill-blank` for cloze-style completion tasks
- `scenario` for branching decision paths
- `speed-challenge` for timed quick-response rounds
- `classification` for sorting items into groups
- `cause-effect` for cause and effect chain alignment
- `map-label` for labeling points or diagram zones
- `memory` for flip-card concept matching
- `debate` for claim and evidence selection
- `team-battle` for team score-based challenges

Notes:

- Escape-room mode was removed from Clibot Edu.
- In the current mock implementation, mode detection is keyword-based, and AI API integration can be plugged into the existing placeholder function in `app/page.tsx`.

## New MVP planning and backend scaffold

- MVP spec document: `docs/mvp-grouping-chat-ai.md`
- Supabase schema migration draft: `supabase/schema.grouping-chat-ai.sql`
- Grouping/chat APIs scaffolded for project-based groups, member presence, and `@ai` replies

## Tech stack

- Next.js App Router
- Supabase Storage
- Optional OpenAI API (`gpt-4o-mini`) with fallback response mode

## Environment variables

Create `.env.local` in this folder and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=... # optional, fallback reply is used if missing
```

Notes:

- This app uses bucket name: `documents`
- Files are organized by course path: `courses/<courseId>/...`
- If bucket is private, preview links will not open without signed URL flow

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vercel deployment

1. Import this folder as a Next.js project in Vercel.
2. Set project root to `edu-16-app`.
3. Add the same environment variables in Vercel Project Settings.
4. Deploy.

## Current API routes

- `POST /api/files/upload`
- `GET /api/files/list?courseId=<id>`
- `POST /api/files/delete`
- `POST /api/files/rename`
- `POST /api/files/summary`
- `POST /api/virtual-teacher/chat`

### New project grouping and group chat APIs

- `POST /api/projects`
- `GET /api/projects?courseId=<id>`
- `POST /api/projects/[projectId]/groups/auto`
- `GET /api/projects/[projectId]/groups`
- `POST /api/projects/[projectId]/groups/assign`
- `GET /api/groups/[groupId]/messages?limit=50&before=<iso>`
- `POST /api/groups/[groupId]/messages`
- `POST /api/groups/[groupId]/presence`
- `GET /api/groups/[groupId]/members`
