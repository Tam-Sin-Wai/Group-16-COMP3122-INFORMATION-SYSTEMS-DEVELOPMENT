import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { assignMembersToGroup } from '@/lib/grouping';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      groupId?: string;
      userIds?: string[];
    };

    const groupId = (body.groupId ?? '').trim();
    const userIds = Array.isArray(body.userIds)
      ? body.userIds.map((id) => id.trim()).filter(Boolean)
      : [];

    if (!groupId) return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    if (userIds.length === 0) return NextResponse.json({ error: 'userIds is required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: group, error: groupError } = await supabase
      .from('project_groups')
      .select('id, project_id, capacity')
      .eq('id', groupId)
      .eq('project_id', projectId)
      .single();

    if (groupError || !group) {
      return NextResponse.json({ error: 'Group not found for this project' }, { status: 404 });
    }

    const { count, error: countError } = await supabase
      .from('project_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (countError) throw new Error(countError.message);

    const available = (group.capacity as number) - (count ?? 0);
    if (available <= 0) {
      return NextResponse.json({ error: 'Group is already full' }, { status: 400 });
    }

    const assignList = userIds.slice(0, available);
    await assignMembersToGroup(projectId, groupId, assignList);

    return NextResponse.json({
      assigned: assignList,
      ignored: userIds.slice(assignList.length),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign members';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
