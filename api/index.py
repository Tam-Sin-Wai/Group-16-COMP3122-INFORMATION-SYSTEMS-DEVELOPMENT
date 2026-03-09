import os
import sys
import json

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
