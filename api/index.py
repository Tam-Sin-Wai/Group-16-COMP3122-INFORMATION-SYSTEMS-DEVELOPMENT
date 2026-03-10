import os
import sys
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates"),
    static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static"),
)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-change-in-prod")
CORS(app)

# ── helpers ─────────────────────────────────────────────────────────────────

def get_supabase_client():
    """Return a Supabase client, or None when credentials are missing."""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


def get_openai_client():
    """Return an OpenAI client, or None when the API key is missing."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=api_key)
    except Exception:
        return None


# ── mock data (used when Supabase is not configured) ───────────────────────

MOCK_COURSES = [
    {
        "id": "1",
        "code": "COMP3122",
        "name": "Information Systems Development",
        "description": "A course on developing modern information systems using contemporary technologies and methodologies.",
    },
    {
        "id": "2",
        "code": "COMP3201",
        "name": "Artificial Intelligence",
        "description": "Foundations of AI including machine learning, neural networks, and intelligent agents.",
    },
    {
        "id": "3",
        "code": "COMP3301",
        "name": "Database Management Systems",
        "description": "Design, implementation, and management of relational and NoSQL databases.",
    },
]

MOCK_GROUPS = [
    {
        "id": "g1",
        "name": "Group Alpha",
        "project": "GenAI-Powered IS Prototype",
        "course_id": "1",
        "course_code": "COMP3122",
        "course_name": "Information Systems Development",
        "status": "active",
        "message_count": 42,
        "last_activity": "10 min ago",
        "members": [
            {"id": "s1", "name": "Alice Chan", "role": "leader", "last_online": "Online now", "avatar": "AC"},
            {"id": "s2", "name": "Bob Lee", "role": "member", "last_online": "2 min ago", "avatar": "BL"},
            {"id": "s3", "name": "Carol Ng", "role": "member", "last_online": "1 hour ago", "avatar": "CN"},
            {"id": "s4", "name": "David Wu", "role": "member", "last_online": "3 hours ago", "avatar": "DW"},
        ],
    },
    {
        "id": "g2",
        "name": "Group Beta",
        "project": "AI Ethics Research Report",
        "course_id": "2",
        "course_code": "COMP3201",
        "course_name": "Artificial Intelligence",
        "status": "active",
        "message_count": 19,
        "last_activity": "2 hours ago",
        "members": [
            {"id": "s5", "name": "Eva Lam", "role": "leader", "last_online": "Online now", "avatar": "EL"},
            {"id": "s6", "name": "Frank Ho", "role": "member", "last_online": "15 min ago", "avatar": "FH"},
            {"id": "s7", "name": "Grace Yip", "role": "member", "last_online": "Yesterday", "avatar": "GY"},
        ],
    },
    {
        "id": "g3",
        "name": "Group Gamma",
        "project": "Database Normalisation Case Study",
        "course_id": "3",
        "course_code": "COMP3301",
        "course_name": "Database Management Systems",
        "status": "active",
        "message_count": 8,
        "last_activity": "1 day ago",
        "members": [
            {"id": "s8", "name": "Henry Tse", "role": "leader", "last_online": "30 min ago", "avatar": "HT"},
            {"id": "s9", "name": "Iris Cheung", "role": "member", "last_online": "2 days ago", "avatar": "IC"},
            {"id": "s10", "name": "Jack Mak", "role": "member", "last_online": "Online now", "avatar": "JM"},
            {"id": "s11", "name": "Kelly Sin", "role": "member", "last_online": "5 hours ago", "avatar": "KS"},
        ],
    },
]

# Mock group chat messages keyed by group_id
MOCK_GROUP_MESSAGES = {
    "g1": [
        {"id": "msg1", "sender": "Alice Chan", "avatar": "AC", "role": "leader", "text": "Hey team! Let's start planning our GenAI prototype. I've outlined three key modules.", "timestamp": "10:02 AM", "is_ai": False},
        {"id": "msg2", "sender": "Bob Lee", "avatar": "BL", "role": "member", "text": "Sounds good Alice. Should we split the backend and frontend tasks?", "timestamp": "10:05 AM", "is_ai": False},
        {"id": "msg3", "sender": "Carol Ng", "avatar": "CN", "role": "member", "text": "@AI What are the key components we should include in an AI-powered IS prototype for COMP3122?", "timestamp": "10:08 AM", "is_ai": False},
        {"id": "msg4", "sender": "EduAI Assistant", "avatar": "AI", "role": "ai", "text": "Great question! For an AI-powered IS prototype in COMP3122, you should consider these key components:\n\n**1. Data Layer** – A structured database (e.g., PostgreSQL/Supabase) to store course data, user profiles, and interaction logs.\n\n**2. AI Integration** – Use an LLM API (e.g., OpenAI GPT) to power features like a virtual teacher, automated summaries, and personalised feedback.\n\n**3. User Interface** – A responsive web UI supporting both teacher and student roles with different dashboards.\n\n**4. Group Collaboration Module** – Real-time or near-real-time group chat, shared task boards, and progress tracking.\n\n**5. Assessment & Feedback Engine** – AI-assisted grading hints and assignment guidance without violating academic integrity.\n\nRemember to align your design with the SDLC phases covered in Week 2!", "timestamp": "10:08 AM", "is_ai": True},
        {"id": "msg5", "sender": "David Wu", "avatar": "DW", "role": "member", "text": "That's really helpful! I'll take on the database schema.", "timestamp": "10:15 AM", "is_ai": False},
        {"id": "msg6", "sender": "Alice Chan", "avatar": "AC", "role": "leader", "text": "Perfect. Carol and I will handle the frontend and AI integration. Bob, can you set up the Flask backend?", "timestamp": "10:17 AM", "is_ai": False},
    ],
    "g2": [
        {"id": "msg1", "sender": "Eva Lam", "avatar": "EL", "role": "leader", "text": "Welcome to our AI Ethics group! Our report is due Mar 20. Let's divide the sections.", "timestamp": "9:00 AM", "is_ai": False},
        {"id": "msg2", "sender": "Frank Ho", "avatar": "FH", "role": "member", "text": "@AI Can you summarise the main ethical frameworks we should apply in our AI ethics essay?", "timestamp": "9:05 AM", "is_ai": False},
        {"id": "msg3", "sender": "EduAI Assistant", "avatar": "AI", "role": "ai", "text": "For your AI Ethics Essay in COMP3201, you should consider these key ethical frameworks:\n\n- **Utilitarianism** – Evaluates AI actions based on overall societal benefit vs harm.\n- **Deontological Ethics** – Focuses on rules and duties (e.g., transparency, fairness obligations).\n- **Virtue Ethics** – Asks what a responsible AI developer or organisation would do.\n- **Care Ethics** – Emphasises relationships and the impact of AI on vulnerable communities.\n\nApply at least two frameworks when analysing your case studies, and always cite peer-reviewed sources (APA 7th edition). The assessment criteria emphasise critical analysis depth and argument cohesion.", "timestamp": "9:05 AM", "is_ai": True},
        {"id": "msg4", "sender": "Grace Yip", "avatar": "GY", "role": "member", "text": "I'll cover bias in AI models. Frank, could you take the regulatory section?", "timestamp": "9:10 AM", "is_ai": False},
    ],
    "g3": [
        {"id": "msg1", "sender": "Henry Tse", "avatar": "HT", "role": "leader", "text": "Team, let's work on the normalisation case study together. Anyone started the ER diagram?", "timestamp": "Yesterday 3:00 PM", "is_ai": False},
        {"id": "msg2", "sender": "Jack Mak", "avatar": "JM", "role": "member", "text": "I started it. Should we normalise to 3NF or BCNF?", "timestamp": "Yesterday 3:15 PM", "is_ai": False},
        {"id": "msg3", "sender": "Jack Mak", "avatar": "JM", "role": "member", "text": "@AI What is the difference between 3NF and BCNF and when should we use each?", "timestamp": "Yesterday 3:16 PM", "is_ai": False},
        {"id": "msg4", "sender": "EduAI Assistant", "avatar": "AI", "role": "ai", "text": "Great question on normalisation! Here's the key difference:\n\n**3NF (Third Normal Form):**\n- Removes transitive dependencies (non-key attributes depending on other non-key attributes).\n- A relation is in 3NF if every non-prime attribute is non-transitively dependent on every candidate key.\n- More practical for real-world databases — minor redundancy is acceptable.\n\n**BCNF (Boyce-Codd Normal Form):**\n- A stricter version of 3NF.\n- Every determinant must be a candidate key.\n- Can sometimes lead to loss of functional dependency preservation.\n\n**When to use which:**\n- Use **3NF** for most practical database designs — it balances normalisation and performance.\n- Use **BCNF** when anomalies still exist after 3NF, and you can afford potential join overhead.\n\nFor your COMP3301 assignment, 3NF is typically sufficient unless specified otherwise.", "timestamp": "Yesterday 3:16 PM", "is_ai": True},
    ],
}

MOCK_MATERIALS = {
    "1": [
        {
            "id": "m1",
            "type": "lecture_notes",
            "title": "Week 1 – Introduction to Information Systems",
            "content": (
                "Information systems (IS) are integrated sets of components for collecting, storing, "
                "and communicating data and knowledge. Key components: hardware, software, data, "
                "people, and processes. Types: TPS, MIS, DSS, EIS. IS supports business operations, "
                "management decision-making, and strategic advantage."
            ),
        },
        {
            "id": "m2",
            "type": "lecture_notes",
            "title": "Week 2 – Systems Development Life Cycle (SDLC)",
            "content": (
                "SDLC phases: Planning, Analysis, Design, Implementation, Maintenance. "
                "Agile vs Waterfall approaches. Prototyping and iterative development. "
                "User requirements gathering techniques: interviews, surveys, workshops. "
                "Documentation and UML diagrams."
            ),
        },
        {
            "id": "m3",
            "type": "assignment",
            "title": "Assignment 1 – IS Development Project Proposal",
            "content": (
                "Students must submit a project proposal for a new information system. "
                "Requirements: (1) Problem statement, (2) Proposed solution overview, "
                "(3) System requirements (functional and non-functional), (4) Preliminary design diagrams, "
                "(5) Project timeline. Assessment criteria: relevance, feasibility, clarity, "
                "proper academic referencing (APA 7th edition). Max 2000 words."
            ),
        },
        {
            "id": "m4",
            "type": "padlet",
            "title": "Padlet – Group Project Discussion: GenAI in IS",
            "content": (
                "Ongoing discussion on integrating GenAI into information systems. "
                "Topics raised: ethical considerations, bias in AI models, cost vs benefit analysis, "
                "real-world case studies (GitHub Copilot, ChatGPT integration in enterprise IS). "
                "Key themes: human-AI collaboration, data privacy, digital transformation."
            ),
        },
        {
            "id": "m5",
            "type": "transcript",
            "title": "Lecture Recording Transcript – Week 3: Database Design",
            "content": (
                "Transcript excerpt: '...Entity-Relationship diagrams help us visualise the data model "
                "before we build it. Remember, normalisation is about removing redundancy. "
                "First normal form requires atomic values. Second removes partial dependencies. "
                "Third removes transitive dependencies. In practice, most systems are designed to 3NF...'"
            ),
        },
    ],
    "2": [
        {
            "id": "m6",
            "type": "lecture_notes",
            "title": "Week 1 – Introduction to Artificial Intelligence",
            "content": (
                "AI overview: narrow AI vs general AI. History from Turing Test to modern LLMs. "
                "Core areas: search algorithms, knowledge representation, machine learning, "
                "natural language processing, computer vision, robotics."
            ),
        },
        {
            "id": "m7",
            "type": "assignment",
            "title": "Assignment 1 – AI Ethics Essay",
            "content": (
                "Write a critical analysis essay (2500 words) on the ethical implications of AI in society. "
                "Must reference at least 8 peer-reviewed sources. "
                "Assessment criteria: critical analysis depth, argument cohesion, ethical framework application, "
                "proper APA referencing."
            ),
        },
    ],
    "3": [
        {
            "id": "m8",
            "type": "lecture_notes",
            "title": "Week 1 – Introduction to Database Systems",
            "content": (
                "Database fundamentals: data vs information, DBMS advantages, relational model. "
                "Key concepts: tables, rows, columns, primary keys, foreign keys. "
                "SQL overview: DDL, DML, DCL, TCL. Introduction to ACID properties."
            ),
        },
        {
            "id": "m9",
            "type": "assignment",
            "title": "Assignment 1 – Database Design Project",
            "content": (
                "Design and implement a relational database for a given business scenario. "
                "Deliverables: ER diagram, normalised schema (3NF), SQL DDL scripts, "
                "sample data, and a report. Assessment criteria: correctness of normalisation, "
                "query efficiency, report clarity."
            ),
        },
    ],
}


def build_system_prompt(course: dict, materials: list) -> str:
    """Build a system prompt for the virtual teacher from course data and materials."""
    sections = {
        "lecture_notes": [],
        "transcript": [],
        "assignment": [],
        "padlet": [],
    }
    for m in materials:
        mtype = m.get("type", "lecture_notes")
        sections.get(mtype, sections["lecture_notes"]).append(
            f"[{m['title']}]\n{m['content']}"
        )

    prompt = f"""You are a virtual teacher for the course "{course['code']} – {course['name']}".

Course description: {course.get('description', '')}

You have access to the following course materials:
"""
    if sections["lecture_notes"]:
        prompt += "\n## LECTURE NOTE SUMMARIES\n" + "\n\n".join(sections["lecture_notes"])
    if sections["transcript"]:
        prompt += "\n\n## LECTURE RECORDING TRANSCRIPTS\n" + "\n\n".join(sections["transcript"])
    if sections["assignment"]:
        prompt += "\n\n## ASSIGNMENT GUIDELINES\n" + "\n\n".join(sections["assignment"])
    if sections["padlet"]:
        prompt += "\n\n## PADLET DISCUSSIONS\n" + "\n\n".join(sections["padlet"])

    prompt += """

## YOUR ROLE AND GUIDELINES

1. **Answer questions** based on the course materials above. Provide accurate, context-specific responses.
2. **Explain core concepts** from lectures clearly, with examples when helpful. Break down complex topics step-by-step.
3. **Foster critical thinking**: connect concepts to the broader course objectives and real-world applications.
4. **Assignment guidance**: help students understand requirements, outline structures, give tips on topics, and align responses with assessment criteria (relevance, cohesion, proper APA referencing). Uphold academic integrity — guide, don't write assignments for students.
5. **Padlet / group discussions**: summarise ongoing discussion themes and help students engage with them.
6. **Tone**: conversational yet professional. Use point-form bullet lists for clarity when appropriate.
7. **Lifelong learning**: encourage curiosity, independent thinking, and the application of concepts beyond the classroom.

If a question is unrelated to this course, politely redirect the student back to course-relevant topics."""
    return prompt


# ── routes – pages ──────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/virtual-teacher")
def virtual_teacher():
    return render_template("virtual_teacher.html")


@app.route("/materials")
def materials():
    return render_template("materials.html")


@app.route("/assignments")
def assignments():
    return render_template("assignments.html")


@app.route("/grades")
def grades():
    return render_template("grades.html")


@app.route("/padlet")
def padlet():
    return render_template("padlet.html")


@app.route("/groups")
def groups():
    return render_template("groups.html")


@app.route("/groups/<group_id>")
def group_chat(group_id: str):
    group = next((g for g in MOCK_GROUPS if g["id"] == group_id), None)
    if not group:
        return render_template("groups.html"), 404
    return render_template("group_chat.html", group=group)


# ── routes – API ─────────────────────────────────────────────────────────────

@app.route("/api/courses")
def api_courses():
    supabase = get_supabase_client()
    if supabase:
        try:
            result = supabase.table("courses").select("*").execute()
            return jsonify({"courses": result.data})
        except Exception as e:
            return jsonify({"error": str(e), "courses": MOCK_COURSES}), 200
    return jsonify({"courses": MOCK_COURSES})


@app.route("/api/courses/<course_id>/materials")
def api_course_materials(course_id: str):
    supabase = get_supabase_client()
    if supabase:
        try:
            result = (
                supabase.table("course_materials")
                .select("*")
                .eq("course_id", course_id)
                .execute()
            )
            return jsonify({"materials": result.data})
        except Exception as e:
            materials = MOCK_MATERIALS.get(course_id, [])
            return jsonify({"error": str(e), "materials": materials}), 200
    return jsonify({"materials": MOCK_MATERIALS.get(course_id, [])})


@app.route("/api/groups")
def api_groups():
    return jsonify({"groups": MOCK_GROUPS})


@app.route("/api/groups/<group_id>")
def api_group(group_id: str):
    group = next((g for g in MOCK_GROUPS if g["id"] == group_id), None)
    if not group:
        return jsonify({"error": "Group not found."}), 404
    messages = MOCK_GROUP_MESSAGES.get(group_id, [])
    return jsonify({"group": group, "messages": messages})


@app.route("/api/groups/<group_id>/ai-chat", methods=["POST"])
def api_group_ai_chat(group_id: str):
    """Handle @AI mentions in a group chat – reuses the virtual-teacher AI logic."""
    group = next((g for g in MOCK_GROUPS if g["id"] == group_id), None)
    if not group:
        return jsonify({"error": "Group not found."}), 404

    data = request.get_json(force=True)
    user_message = data.get("message", "").strip()
    conversation_history = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    course_id = group["course_id"]

    # Fetch course info
    supabase = get_supabase_client()
    course = None
    materials = []
    if supabase:
        try:
            c_result = supabase.table("courses").select("*").eq("id", course_id).execute()
            if c_result.data:
                course = c_result.data[0]
            m_result = (
                supabase.table("course_materials")
                .select("*")
                .eq("course_id", course_id)
                .execute()
            )
            materials = m_result.data or []
        except Exception:
            pass

    if not course:
        course = next((c for c in MOCK_COURSES if c["id"] == course_id), None)
    if not materials:
        materials = MOCK_MATERIALS.get(course_id, [])

    if not course:
        return jsonify({"error": "Course not found."}), 404

    openai_client = get_openai_client()
    if not openai_client:
        return jsonify({
            "reply": (
                "⚠️ The AI service is not configured yet. "
                "Please set the OPENAI_API_KEY environment variable to enable AI chat in study groups. "
                f"Once configured, I will be able to answer questions about "
                f"{course['code']} – {course['name']}."
            )
        })

    system_prompt = build_system_prompt(course, materials)
    # Extend with group-context instruction
    system_prompt += (
        f"\n\n## GROUP CONTEXT\n"
        f"You are also the AI assistant for study group '{group['name']}' working on the project "
        f"'{group['project']}'. Students may @-mention you in the group chat. "
        "Provide concise, helpful responses relevant to both the course materials and their project."
    )

    messages = [{"role": "system", "content": system_prompt}]
    for entry in conversation_history[-10:]:
        role = entry.get("role")
        content = entry.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": f"AI service error: {str(e)}"}), 500


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True)
    course_id = data.get("course_id", "")
    user_message = data.get("message", "").strip()
    conversation_history = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400
    if not course_id:
        return jsonify({"error": "Please select a course first."}), 400

    # Fetch course info
    supabase = get_supabase_client()
    course = None
    materials = []
    if supabase:
        try:
            c_result = supabase.table("courses").select("*").eq("id", course_id).execute()
            if c_result.data:
                course = c_result.data[0]
            m_result = (
                supabase.table("course_materials")
                .select("*")
                .eq("course_id", course_id)
                .execute()
            )
            materials = m_result.data or []
        except Exception:
            pass

    if not course:
        course = next((c for c in MOCK_COURSES if c["id"] == course_id), None)
    if not materials:
        materials = MOCK_MATERIALS.get(course_id, [])

    if not course:
        return jsonify({"error": "Course not found."}), 404

    openai_client = get_openai_client()
    if not openai_client:
        return jsonify({
            "reply": (
                "⚠️ The AI service is not configured yet. "
                "Please set the OPENAI_API_KEY environment variable to enable the virtual teacher. "
                "Once configured, I will be able to answer questions about "
                f"{course['code']} – {course['name']}."
            )
        })

    system_prompt = build_system_prompt(course, materials)

    messages = [{"role": "system", "content": system_prompt}]
    for entry in conversation_history[-10:]:
        role = entry.get("role")
        content = entry.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": f"AI service error: {str(e)}"}), 500


# ── Vercel entry point ────────────────────────────────────────────────────────

if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    app.run(debug=debug, port=5000)
