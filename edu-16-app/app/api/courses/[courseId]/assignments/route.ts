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

    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('course_id', courseId)
      .eq('status', 'active')
      .order('due_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ assignments: data || [] });
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
    const { title, description, due_date, max_marks, created_by } = body;

    if (!title || !due_date || !created_by) {
      return NextResponse.json(
        { error: 'title, due_date, and created_by are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        course_id: courseId,
        title,
        description,
        due_date,
        max_marks: max_marks || 100,
        created_by,
        status: 'active',
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ assignment: data?.[0] }, { status: 201 });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
