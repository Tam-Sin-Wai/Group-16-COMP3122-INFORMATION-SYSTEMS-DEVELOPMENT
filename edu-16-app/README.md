# EduAI Next.js App

Course-aware learning platform prototype with GenAI virtual teacher and file upload center.

## Implemented now

- Virtual Teacher chat per course (context-aware by selected course)
- Upload Center for course knowledge base files
- File list, preview, rename, delete, and quick summary
- Placeholder UI blocks for future modules (Assignments, Padlet Insights, Study Group Hub)

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
