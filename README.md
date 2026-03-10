# EduAI – AI-Powered Personalised Learning Platform

**Group 16 · COMP3122 Information Systems Development · 2025/26 Semester 2**

A teacher-facilitated, student-centred, personalised, and interactive learning platform
powered by Generative AI — enabling teachers to deliver adaptive learning experiences at scale.

---------------------------------------------------------------------------
Todo
---------------------------------------------------------------------------
add keys to vercel : ai api, supabase api
add functions









---


## Platform Vision

EduAI empowers teachers to create meaningful, personalised learning journeys for every student.
Rather than a passive content repository, the platform actively facilitates:

- 🎓 **Personalised AI tutoring** – students get course-specific answers from a virtual teacher trained on actual course materials
- 👥 **Teacher-assigned study groups** – teachers group students for projects; each group gets its own AI-assisted chat room
- 💬 **AI in the chat** – students can `@AI` in any group chat to get instant, context-aware answers from course materials
- 📊 **Progress visibility** – last-online status, assignment tracking, and grade overviews for informed teacher interventions

---

## Features

| Feature | Status |
|---|---|
| **Virtual Teacher** (AI chat per course) | ✅ Implemented |
| **Study Groups** (teacher-assigned, with group chat) | ✅ Implemented |
| **@AI in Group Chat** (course-aware AI assistant) | ✅ Implemented |
| **Member last-online status** in group chat | ✅ Implemented |
| Course Materials viewer | 🔜 Coming soon |
| Assignments tracker | 🔜 Coming soon |
| Grades overview | 🔜 Coming soon |
| Class Discussions board | 🔜 Coming soon |

### Virtual Teacher
Powered by OpenAI GPT-4o-mini, the virtual teacher draws context from:
- Lecture note summaries
- Lecture recording transcripts
- Assignment guidelines
- Class discussion threads

Students select their course and the AI provides accurate, context-specific responses to support their learning journey.

### Study Groups
Teachers create project groups per assignment, and students are auto-assigned or manually placed.
Each group gets:
- A persistent **group chat room** visible to all members
- **Last-online indicators** per student (Online now / X min ago / X hours ago)
- An embedded **AI assistant** — type `@AI <question>` to invoke it in any group message

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · Flask |
| AI | OpenAI API (GPT-4o-mini) |
| Database | Supabase (PostgreSQL) |
| Frontend | HTML · Tailwind CSS · JavaScript |
| Deployment | Vercel |

---

## Local Development

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd Group-16-COMP3122-INFORMATION-SYSTEMS-DEVELOPMENT
pip install -r requirements.txt
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in:
#   OPENAI_API_KEY
#   SUPABASE_URL
#   SUPABASE_KEY
#   FLASK_SECRET_KEY
```

### 3. Set up the database

Open the **Supabase SQL Editor** for your project and run the contents of `supabase/schema.sql`.

### 4. Run the app

```bash
python api/index.py
```

Visit `http://localhost:5000` in your browser.

> **Note:** The app includes mock course data and materials, so it works even without a Supabase connection configured. The AI chat requires a valid `OPENAI_API_KEY`.

---

## Deployment to Vercel

1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add the environment variables (`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `FLASK_SECRET_KEY`) in the Vercel project settings.
4. Deploy — Vercel will automatically use `vercel.json` to route requests to the Flask app.

---

## Project Structure

```
├── api/
│   └── index.py              # Flask application (Vercel entry point)
├── templates/
│   ├── base.html              # Base layout with sidebar navigation
│   ├── index.html             # Dashboard
│   ├── virtual_teacher.html   # AI chat page (per course)
│   ├── groups.html            # Study groups listing
│   ├── group_chat.html        # Individual group chat with @AI support
│   ├── materials.html         # Course Materials (placeholder)
│   ├── assignments.html       # Assignments (placeholder)
│   ├── grades.html            # Grades (placeholder)
│   └── padlet.html            # Class Discussions (placeholder)
├── static/
│   ├── css/style.css          # Custom styles
│   ├── js/chat.js             # Virtual Teacher chat logic
│   └── js/group_chat.js       # Group chat logic (@AI support)
├── supabase/
│   └── schema.sql             # Supabase database schema (incl. study_groups)
├── PROGRESS.md                # Developer task checklist
├── requirements.txt
├── vercel.json
└── .env.example
```

---

## Group 16 Members

*COMP3122 · 2025/26 Semester 2*
