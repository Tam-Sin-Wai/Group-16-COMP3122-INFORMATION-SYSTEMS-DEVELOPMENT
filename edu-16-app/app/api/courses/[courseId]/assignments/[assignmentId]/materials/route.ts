import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getErrorMessage } from '@/lib/errorHandler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; assignmentId: string }> }
) {
  const supabase = getSupabaseServer();
  try {
    const { courseId, assignmentId } = await params;

    const { data, error } = await supabase
      .from('assignment_materials')
      .select(`
        relevance_score,
        course_materials (
          id,
          title,
          type,
          description,
          url,
          file_path
        )
      `)
      .eq('assignment_id', assignmentId)
      .order('relevance_score', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ materials: data || [] });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; assignmentId: string }> }
) {
  const supabase = getSupabaseServer();
  try {
    const { courseId, assignmentId } = await params;
    const body = await request.json();
    const { material_id, relevance_score = 5 } = body;

    if (!material_id) {
      return NextResponse.json(
        { error: 'material_id is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('assignment_materials')
      .insert({
        assignment_id: assignmentId,
        material_id,
        relevance_score,
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ link: data?.[0] }, { status: 201 });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}