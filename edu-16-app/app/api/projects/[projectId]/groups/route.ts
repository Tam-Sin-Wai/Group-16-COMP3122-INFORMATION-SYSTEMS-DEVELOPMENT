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

    const { data: lastMessages, error: messageError } = await supabase
      .from('group_messages')
      .select('group_id, created_at')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false });

    // Group chat backend may be disabled; keep this endpoint usable without chat tables.
    const safeLastMessages = messageError ? [] : (lastMessages ?? []);

    const latestChatAtByGroup = new Map<string, string>();
    for (const row of safeLastMessages) {
      const gId = row.group_id as string;
      if (!latestChatAtByGroup.has(gId)) {
        latestChatAtByGroup.set(gId, row.created_at as string);
      }
    }

    const response = (groups ?? []).map((group) => ({
      ...group,
      members: membersByGroup.get(group.id as string) ?? [],
      memberCount: (membersByGroup.get(group.id as string) ?? []).length,
      latestChatAt: latestChatAtByGroup.get(group.id as string) ?? null,
    }));

    return NextResponse.json({ groups: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list groups';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      groupCount?: number;
      maxPerGroup?: number;
      presetStudentIds?: string[];
    };

    const groupCount = Number(body.groupCount ?? 0);
    const maxPerGroup = Number(body.maxPerGroup ?? 0);
    const presetStudentIds = Array.isArray(body.presetStudentIds)
      ? body.presetStudentIds.map((id) => id.trim()).filter(Boolean)
      : [];

    if (!Number.isInteger(groupCount) || groupCount <= 0) {
      return NextResponse.json({ error: 'groupCount must be a positive integer' }, { status: 400 });
    }
    if (!Number.isInteger(maxPerGroup) || maxPerGroup <= 0) {
      return NextResponse.json({ error: 'maxPerGroup must be a positive integer' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from('project_groups')
      .select('id')
      .eq('project_id', projectId)
      .limit(1);

    if (existingError) throw new Error(existingError.message);
    if ((existing ?? []).length > 0) {
      return NextResponse.json({ error: 'Groups already exist for this project' }, { status: 400 });
    }

    const groupRows = Array.from({ length: groupCount }, (_, i) => ({
      project_id: projectId,
      name: `Group ${i + 1}`,
      capacity: maxPerGroup,
    }));

    const { data: createdGroups, error: createError } = await supabase
      .from('project_groups')
      .insert(groupRows)
      .select('id, project_id, name, capacity, created_at')
      .order('created_at', { ascending: true });

    if (createError) throw new Error(createError.message);

    const groups = createdGroups ?? [];

    const assignments: Array<{ project_id: string; group_id: string; user_id: string }> = [];
    if (groups.length > 0 && presetStudentIds.length > 0) {
      const remainingSlots = new Map<string, number>();
      for (const group of groups) {
        remainingSlots.set(group.id as string, maxPerGroup);
      }

      let cursor = 0;
      for (const studentId of presetStudentIds) {
        let attempts = 0;
        while (attempts < groups.length) {
          const group = groups[cursor % groups.length];
          const groupId = group.id as string;
          const left = remainingSlots.get(groupId) ?? 0;
          cursor += 1;
          attempts += 1;
          if (left <= 0) continue;
          assignments.push({ project_id: projectId, group_id: groupId, user_id: studentId });
          remainingSlots.set(groupId, left - 1);
          break;
        }
      }
    }

    if (assignments.length > 0) {
      const { error: assignError } = await supabase.from('project_group_members').insert(assignments);
      if (assignError) throw new Error(assignError.message);
    }

    return NextResponse.json({
      createdGroupCount: groups.length,
      assignedCount: assignments.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create groups';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
