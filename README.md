# EduAI – GenAI Learning Platform

**Group 16 · COMP3122 Information Systems Development · 2025/26 Semester 2**

A student-centred, personalized, and interactive learning platform integrated with Generative AI.

---

## Features

| Feature | Status |
|---|---|
| **Virtual Teacher** (AI chat per course) | ✅ Implemented |
| Course Materials viewer | 🔜 Coming soon |
| Assignments tracker | 🔜 Coming soon |
| Grades overview | 🔜 Coming soon |
| Padlet Discussions | 🔜 Coming soon |

### Virtual Teacher
Powered by OpenAI GPT-4o-mini, the virtual teacher draws context from:
- Lecture note summaries
- Lecture recording transcripts
- Assignment guidelines
- Padlet discussion threads

Students select their course and the AI provides accurate, context-specific responses to support their learning journey.

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
│   └── index.py          # Flask application (Vercel entry point)
├── templates/
│   ├── base.html          # Base layout with sidebar navigation
│   ├── index.html         # Dashboard
│   ├── virtual_teacher.html  # AI chat page
│   ├── materials.html     # Course Materials (placeholder)
│   ├── assignments.html   # Assignments (placeholder)
│   ├── grades.html        # Grades (placeholder)
│   └── padlet.html        # Padlet Discussions (placeholder)
├── static/
│   ├── css/style.css      # Custom styles
│   └── js/chat.js         # Chat interface logic
├── supabase/
│   └── schema.sql         # Supabase database schema
├── requirements.txt
├── vercel.json
└── .env.example
```

---

## Group 16 Members

*COMP3122 · 2025/26 Semester 2*
