import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getErrorMessage } from '@/lib/errorHandler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = getSupabaseServer();
  try {
    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const { data, error } = await supabase
      .from('frequently_asked_questions')
      .select('*')
      .eq('course_id', courseId)
      .order('frequency', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ faqs: data || [] });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}