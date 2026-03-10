# EduAI – Project Progress Tracker

**Project Title:** EduAI – AI-Powered Personalised Learning Platform
**Course:** COMP3122 Information Systems Development · 2025/26 Semester 2
**Team:** Group 16 (4 Human Developers + AI Copilot)

---

## Foundation completed by AI Copilot (kick-start)

The following has been implemented by the AI copilot and is ready for the team to build upon:

- [x] Flask application scaffold with Vercel deployment configuration
- [x] Base HTML layout with responsive sidebar navigation
- [x] Dashboard (`/`) with course overview, stats, and quick actions
- [x] Virtual Teacher (`/virtual-teacher`) – AI chat using GPT-4o-mini, course-context aware
- [x] Study Groups listing page (`/groups`) – teacher creates groups, auto-assign support (UI)
- [x] Group Chat page (`/groups/<id>`) – per-group chat with member last-online status
- [x] `@AI` mention in group chat – triggers course-aware AI assistant reply
- [x] Mock data for courses, materials, groups, and group messages
- [x] Course Materials placeholder page (`/materials`)
- [x] Assignments placeholder page (`/assignments`)
- [x] Grades placeholder page (`/grades`)
- [x] Class Discussions placeholder page (`/padlet`)
- [x] Supabase schema (courses, materials, chat history, study groups, group members, group messages)
- [x] README with platform vision, feature table, and setup guide

---

## Developer Tasks (Post Kick-start)

Below is the recommended task split for the 4-person developer team.
Pick a task by writing your name next to it and open a pull request.

---

### 👤 Developer 1 – Authentication & User Roles

- [ ] Integrate Supabase Auth (email/password login)
- [ ] Implement student and teacher role distinction
- [ ] Protect routes: redirect unauthenticated users to a login page
- [ ] Display logged-in user's real name and avatar in the sidebar and top bar
- [ ] Store and read `last_online` timestamp in `group_members` table on login/activity

**Relevant files:** `api/index.py`, `templates/base.html`, `supabase/schema.sql`

---

### 👤 Developer 2 – Study Groups Backend

- [ ] Replace mock group data with real Supabase queries (`study_groups`, `group_members`)
- [ ] Implement teacher endpoint to create groups (`POST /api/groups`)
- [ ] Implement auto-grouping: assign students without a group to available groups
- [ ] Implement add/remove member endpoints for teachers
- [ ] Persist group chat messages to `group_messages` table on send
- [ ] Load real message history from `group_messages` on page load (paginated)

**Relevant files:** `api/index.py`, `static/js/group_chat.js`, `supabase/schema.sql`

---

### 👤 Developer 3 – Course Materials & Assignments

- [ ] Build live Course Materials page: fetch and display materials from Supabase by course
- [ ] Add file-upload feature so teachers can attach PDFs/slides to course materials
- [ ] Build Assignments page: list assignments with due dates fetched from Supabase
- [ ] Allow teachers to create/edit assignments with title, description, due date, and max marks
- [ ] Allow students to mark an assignment as "In Progress" (status update)
- [ ] Add deadline countdown badges (red if ≤ 7 days)

**Relevant files:** `templates/materials.html`, `templates/assignments.html`, `api/index.py`, `supabase/schema.sql`

---

### 👤 Developer 4 – Grades & Class Discussions

- [ ] Build Grades page: fetch per-student grades from Supabase, show grade + percentage bar
- [ ] Allow teachers to input/update grades via a simple form
- [ ] Build Class Discussions page with real Supabase-backed posts and replies
- [ ] Allow teachers to create discussion topics; students can post replies
- [ ] Add AI-summarise button on each discussion board (calls `/api/chat` with discussion text)
- [ ] Add notification count to the bell icon in the top bar (unread discussions/assignment updates)

**Relevant files:** `templates/grades.html`, `templates/padlet.html`, `api/index.py`, `supabase/schema.sql`

---

## Shared Tasks (All Developers)

- [ ] Write unit tests for any new API endpoints added (use `pytest`)
- [ ] Test the full user flow (teacher creates group → students join → chat with @AI)
- [ ] Update `supabase/schema.sql` with any new tables or columns you add
- [ ] Update `README.md` to reflect newly completed features
- [ ] Update this `PROGRESS.md` file as tasks are completed
- [ ] Conduct a final demo and record a short screen-capture walkthrough

---

## Sprint Schedule (Suggested)

| Sprint | Week | Focus |
|--------|------|-------|
| Sprint 1 | Week 1–2 | Authentication (Dev 1) + Groups backend (Dev 2) |
| Sprint 2 | Week 3–4 | Materials & Assignments (Dev 3) + Grades & Discussions (Dev 4) |
| Sprint 3 | Week 5–6 | Integration testing, bug fixes, and final demo |

---

*Last updated by AI Copilot kick-start — 2026-03-10*
