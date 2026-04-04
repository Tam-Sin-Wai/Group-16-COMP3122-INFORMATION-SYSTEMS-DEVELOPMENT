import { NextResponse } from 'next/server';
import { getCourseById } from '@/lib/courseData';
import { askOpenAI, buildCourseContext, fallbackTeacherReply } from '@/lib/virtualTeacher';
import { getSupabaseServer } from '@/lib/supabaseServer';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function POST(request: Request) {
  const supabase = getSupabaseServer();
  try {
    const body = (await request.json()) as {
      courseId?: string;
      message?: string;
      history?: ChatMessage[];
      userId?: string;
    };

    const courseId = body.courseId || 'comp3122';
    const message = (body.message || '').trim();
    const history = body.history || [];
    const userId = body.userId;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const course = getCourseById(courseId);
    const courseContext = buildCourseContext(course);
    const compactHistory = history
      .slice(-6)
      .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
      .join('\n');

    const systemPrompt = [
      'You are a virtual teacher for a university course.',
      'Use only the provided course context. If context is insufficient, state limitations clearly.',
      'Support theory explanation, non-open factual questions, assignment structure guidance, and course tool engagement summary.',
      'Use conversational but professional tone. Prefer concise bullet points when appropriate.',
      'Do not write complete assignment answers for direct submission. Preserve academic integrity.',
      '',
      courseContext,
    ].join('\n');

    const userPrompt = [
      compactHistory ? `Conversation history:\n${compactHistory}` : 'No prior messages.',
      `Student question: ${message}`,
    ].join('\n\n');

    const aiResponse = await askOpenAI(systemPrompt, userPrompt);
    const response = aiResponse || fallbackTeacherReply(course, message);

    // Log the interaction for FAQ tracking
    try {
      await supabase.from('virtual_teacher_logs').insert({
        course_id: courseId,
        user_id: userId,
        question: message,
        response: response,
        response_source: aiResponse ? 'openai' : 'fallback',
      });

      // Update or insert FAQ frequency
      const { data: existingFAQ } = await supabase
        .from('frequently_asked_questions')
        .select('id, frequency')
        .eq('course_id', courseId)
        .eq('question', message)
        .single();

      if (existingFAQ) {
        await supabase
          .from('frequently_asked_questions')
          .update({
            frequency: existingFAQ.frequency + 1,
            last_asked: new Date().toISOString(),
          })
          .eq('id', existingFAQ.id);
      } else {
        await supabase.from('frequently_asked_questions').insert({
          course_id: courseId,
          question: message,
          answer: response,
          frequency: 1,
        });
      }
    } catch (logError) {
      // Don't fail the response if logging fails
      console.error('Failed to log virtual teacher interaction:', logError);
    }

    return NextResponse.json({ response, source: aiResponse ? 'openai' : 'fallback' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
