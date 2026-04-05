import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getCourseById } from '@/lib/courseData';
import { askOpenAI } from '@/lib/virtualTeacher';
import { getErrorMessage } from '@/lib/errorHandler';

type QuizQuestion = {
  type?: 'multiple_choice' | 'short_answer' | 'true_false' | string;
  question?: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
};

function buildFallbackQuestion(courseName: string, type: string, index: number): QuizQuestion {
  const subject = courseName.toLowerCase();
  const prompts = [
    `What is the most important ${subject} concept to remember from this course?`,
    `Which statement best matches the core idea behind ${courseName}?`,
    `What should a student do first when answering a ${subject} multiple-choice question?`,
    `Which option shows the strongest understanding of the course material?`,
    `What is the best application of the key idea covered in ${courseName}?`,
  ];

  const baseQuestion = prompts[index % prompts.length];
  return {
    type: type === 'revision' ? 'multiple_choice' : 'multiple_choice',
    question: baseQuestion,
    options: [
      'A. The most relevant concept',
      'B. A partially related idea',
      'C. An unrelated detail',
      'D. A random guess',
    ],
    correct_answer: 'A. The most relevant concept',
    explanation: `This question reinforces the main ideas from ${courseName}.`,
  };
}

function normalizeQuizQuestions(questions: QuizQuestion[] | undefined, targetCount: number, courseName: string, type: string) {
  const normalized = Array.isArray(questions) ? questions.slice(0, targetCount) : [];

  while (normalized.length < targetCount) {
    normalized.push(buildFallbackQuestion(courseName, type, normalized.length));
  }

  return normalized;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = getSupabaseServer();
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { type = 'practice', numQuestions = 5, created_by } = body;

    if (!created_by) {
      return NextResponse.json(
        { error: 'created_by is required' },
        { status: 400 }
      );
    }

    const course = getCourseById(courseId);
    const courseContext = course.resources
      .map((resource) => `[${resource.type}] ${resource.title}: ${resource.content}`)
      .join('\n');

    const systemPrompt = `You are an AI assistant that generates educational quizzes for university courses.
  Based on the provided course materials, create a ${type} quiz with exactly ${numQuestions} questions.
For practice quizzes, include multiple choice and short answer questions.
For exam quizzes, include more complex questions.
For revision quizzes, focus on key concepts and summaries.

Return the quiz as a JSON object with this structure:
{
  "title": "Quiz Title",
  "description": "Brief description",
  "questions": [
    {
      "type": "multiple_choice" | "short_answer" | "true_false",
      "question": "Question text",
      "options": ["A", "B", "C", "D"] // only for multiple_choice
      "correct_answer": "Correct answer",
      "explanation": "Why this is correct"
    }
  ]
}

Use only the provided course context. Make questions relevant and educational.`;

    const userPrompt = `Course: ${course.code} ${course.name}
Materials:
${courseContext}

Generate a ${type} quiz with ${numQuestions} questions.`;

    const aiResponse = await askOpenAI(systemPrompt, userPrompt);
    if (!aiResponse) {
      return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 });
    }

    let quizData;
    try {
      quizData = JSON.parse(aiResponse);
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid quiz format generated' }, { status: 500 });
    }

    const questions = normalizeQuizQuestions(quizData.questions, numQuestions, course.name, type);

    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        course_id: courseId,
        title: quizData.title || `${course.name} ${type} Quiz`,
        description: quizData.description || `Auto-generated ${type} quiz`,
        type,
        questions,
        created_by,
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ quiz: data?.[0] }, { status: 201 });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = getSupabaseServer();
  try {
    const { courseId } = await params;

    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ quizzes: data || [] });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}