import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getCourseById } from '@/lib/courseData';
import { askOpenAI } from '@/lib/virtualTeacher';
import { getErrorMessage } from '@/lib/errorHandler';

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
Based on the provided course materials, create a ${type} quiz with ${numQuestions} questions.
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

    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        course_id: courseId,
        title: quizData.title || `${course.name} ${type} Quiz`,
        description: quizData.description || `Auto-generated ${type} quiz`,
        type,
        questions: quizData.questions || [],
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