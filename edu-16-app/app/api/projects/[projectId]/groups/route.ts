import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: groups, error: groupsError } = await supabase
      .from('project_groups')
      .select('id, project_id, name, capacity, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (groupsError) throw new Error(groupsError.message);

    const groupIds = (groups ?? []).map((group) => group.id as string);

    if (groupIds.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const { data: members, error: membersError } = await supabase
      .from('project_group_members')
      .select('group_id, user_id, joined_at')
      .in('group_id', groupIds)
      .order('joined_at', { ascending: true });

    if (membersError) throw new Error(membersError.message);

    const membersByGroup = new Map<string, Array<{ user_id: string; joined_at: string }>>();
    for (const member of members ?? []) {
      const groupId = member.group_id as string;
      const current = membersByGroup.get(groupId) ?? [];
      current.push({
        user_id: member.user_id as string,
        joined_at: member.joined_at as string,
      });
      membersByGroup.set(groupId, current);
    }

    const response = (groups ?? []).map((group) => ({
      ...group,
      members: membersByGroup.get(group.id as string) ?? [],
      memberCount: (membersByGroup.get(group.id as string) ?? []).length,
    }));

    return NextResponse.json({ groups: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list groups';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
