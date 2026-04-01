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
      .from('course_materials')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ materials: data || [] });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const body = await request.json();
    const { title, type, description, url, file_path, uploaded_by } = body;

    if (!title || !type) {
      return NextResponse.json(
        { error: 'title and type are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('course_materials')
      .insert({
        course_id: courseId,
        title,
        type,
        description,
        url,
        file_path,
        uploaded_by,
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ material: data?.[0] }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
