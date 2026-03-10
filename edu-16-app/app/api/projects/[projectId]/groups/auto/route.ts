import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  assignMembersToGroup,
  createProjectGroup,
  getEligibleStudentIds,
  getGroupMemberCount,
  splitIntoChunks,
} from '@/lib/grouping';

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, course_id, target_group_size, max_groups')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const courseId = project.course_id as string;
    const targetGroupSize = project.target_group_size as number;
    const maxGroups = project.max_groups as number | null;

    const ungroupedStudentIds = await getEligibleStudentIds(courseId, projectId);
    if (ungroupedStudentIds.length === 0) {
      return NextResponse.json({
        message: 'No ungrouped students found',
        assignedCount: 0,
        createdGroupCount: 0,
      });
    }

    const { data: existingGroups, error: groupsError } = await supabase
      .from('project_groups')
      .select('id, name, capacity')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (groupsError) throw new Error(groupsError.message);

    let cursor = 0;
    let assignedCount = 0;

    for (const group of existingGroups ?? []) {
      if (cursor >= ungroupedStudentIds.length) break;
      const memberCount = await getGroupMemberCount(group.id as string);
      const freeSlots = (group.capacity as number) - memberCount;
      if (freeSlots <= 0) continue;

      const toAssign = ungroupedStudentIds.slice(cursor, cursor + freeSlots);
      await assignMembersToGroup(projectId, group.id as string, toAssign);
      cursor += toAssign.length;
      assignedCount += toAssign.length;
    }

    const remaining = ungroupedStudentIds.slice(cursor);
    if (remaining.length === 0) {
      return NextResponse.json({
        message: 'Auto grouping completed using existing groups',
        assignedCount,
        createdGroupCount: 0,
      });
    }

    const existingCount = (existingGroups ?? []).length;
    const possibleNewGroups = splitIntoChunks(remaining, targetGroupSize);

    const limitedChunks =
      typeof maxGroups === 'number' && maxGroups > 0
        ? possibleNewGroups.slice(0, Math.max(0, maxGroups - existingCount))
        : possibleNewGroups;

    let createdGroupCount = 0;
    for (let i = 0; i < limitedChunks.length; i += 1) {
      const members = limitedChunks[i];
      if (members.length === 0) continue;

      const newGroup = await createProjectGroup(projectId, targetGroupSize, existingCount + createdGroupCount + 1);
      await assignMembersToGroup(projectId, newGroup.id, members);
      createdGroupCount += 1;
      assignedCount += members.length;
    }

    return NextResponse.json({
      message: 'Auto grouping completed',
      assignedCount,
      createdGroupCount,
      unassignedCount: remaining.length - limitedChunks.flat().length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run auto-grouping';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
