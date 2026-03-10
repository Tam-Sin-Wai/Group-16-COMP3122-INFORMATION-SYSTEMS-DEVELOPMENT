import { NextResponse } from 'next/server';
import { getCourseById } from '@/lib/courseData';
import { resolveCourseIdByGroupId } from '@/lib/grouping';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { askOpenAI, buildCourseContext, fallbackTeacherReply } from '@/lib/virtualTeacher';

const AI_MENTION_REGEX = /(^|\s)@ai\b/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 200);
    const before = searchParams.get('before');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('group_messages')
      .select('id, group_id, sender_id, sender_name, body, message_type, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ messages: (data ?? []).reverse() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load messages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const body = (await request.json()) as {
      senderId?: string;
      senderName?: string;
      message?: string;
      courseId?: string;
    };

    const message = (body.message ?? '').trim();
    const senderName = (body.senderName ?? 'Student').trim();
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: inserted, error: insertError } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id: body.senderId ?? null,
        sender_name: senderName,
        body: message,
        message_type: 'user',
      })
      .select('id, group_id, sender_id, sender_name, body, message_type, created_at')
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? 'Failed to send message');
    }

    let aiMessage: unknown = null;
    if (AI_MENTION_REGEX.test(message)) {
      const { data: latestMessages, error: historyError } = await supabase
        .from('group_messages')
        .select('sender_name, body, message_type, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(12);

      if (historyError) throw new Error(historyError.message);

      const resolvedCourseId = body.courseId?.trim() || (await resolveCourseIdByGroupId(groupId));
      const course = getCourseById(resolvedCourseId);
      const compactHistory = (latestMessages ?? [])
        .reverse()
        .map((item) => `${item.sender_name} (${item.message_type}): ${item.body}`)
        .join('\n');

      const systemPrompt = [
        'You are an AI teaching assistant in a student project group chat.',
        'Answer with practical, course-aligned guidance.',
        'If information is uncertain, state limitations clearly.',
        'Do not provide final copy-paste assignment answers.',
        '',
        buildCourseContext(course),
      ].join('\n');

      const userPrompt = [
        `Recent group chat:\n${compactHistory || 'No history available.'}`,
        `Latest message with mention: ${message}`,
        'Reply as a concise assistant message for the same group.',
      ].join('\n\n');

      const aiResponse =
        (await askOpenAI(systemPrompt, userPrompt)) ??
        fallbackTeacherReply(course, message.replace(AI_MENTION_REGEX, '').trim() || message);

      const { data: insertedAi, error: aiError } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: null,
          sender_name: 'AI Tutor',
          body: aiResponse,
          message_type: 'ai',
        })
        .select('id, group_id, sender_id, sender_name, body, message_type, created_at')
        .single();

      if (aiError) throw new Error(aiError.message);
      aiMessage = insertedAi;
    }

    return NextResponse.json({ message: inserted, aiMessage }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
