import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getErrorMessage, isMissingSupabaseConfigError } from '@/lib/errorHandler';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('projects')
      .select('id, course_id, name, description, target_group_size, max_groups, status, created_by, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ projects: data ?? [] });
  } catch (error) {
    const message = getErrorMessage(error);
    if (isMissingSupabaseConfigError(message)) {
      return NextResponse.json({ projects: [], fallback: true });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      courseId?: string;
      name?: string;
      description?: string;
      targetGroupSize?: number;
      maxGroups?: number | null;
      createdBy?: string;
      status?: 'draft' | 'grouping' | 'active' | 'archived';
    };

    const courseId = (body.courseId ?? '').trim();
    const name = (body.name ?? '').trim();
    const targetGroupSize = body.targetGroupSize ?? 0;
    const createdBy = (body.createdBy ?? '').trim();

    if (!courseId) return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!createdBy) return NextResponse.json({ error: 'createdBy is required' }, { status: 400 });
    if (!Number.isInteger(targetGroupSize) || targetGroupSize <= 0) {
      return NextResponse.json({ error: 'targetGroupSize must be a positive integer' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        course_id: courseId,
        name,
        description: body.description ?? null,
        target_group_size: targetGroupSize,
        max_groups: body.maxGroups ?? null,
        status: body.status ?? 'draft',
        created_by: createdBy,
      })
      .select('id, course_id, name, description, target_group_size, max_groups, status, created_by, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create project');
    }

    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
