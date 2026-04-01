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
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    let query = supabase
      .from('grades')
      .select('*, student:user_id(display_name), grader:graded_by(display_name), assignments(title, due_date)')
      .eq('course_id', courseId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ grades: data || [] });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = getSupabaseServer();
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { user_id, assignment_id, marks_obtained, max_marks, feedback, graded_by } = body;

    if (!user_id || !marks_obtained) {
      return NextResponse.json(
        { error: 'user_id and marks_obtained are required' },
        { status: 400 }
      );
    }

    const percentage = ((marks_obtained / (max_marks || 100)) * 100).toFixed(2);

    const { data, error } = await supabase
      .from('grades')
      .insert({
        course_id: courseId,
        user_id,
        assignment_id,
        marks_obtained,
        max_marks: max_marks || 100,
        percentage: parseFloat(percentage),
        feedback,
        graded_by,
      })
      .select('*, student:user_id(display_name), grader:graded_by(display_name), assignments(title, due_date)');

    if (error) throw error;

    return NextResponse.json({ grade: data?.[0] }, { status: 201 });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
