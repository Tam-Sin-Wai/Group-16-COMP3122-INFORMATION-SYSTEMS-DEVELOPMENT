import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type GroupRow = {
  id: string;
  name: string;
  capacity: number;
};

export async function getGroupMemberCount(groupId: string) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('project_group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId);

  if (error) throw new Error(`Failed to get member count: ${error.message}`);
  return count ?? 0;
}

export async function getEligibleStudentIds(courseId: string, projectId: string) {
  const supabase = getSupabaseAdmin();

  const { data: enrolled, error: enrolledError } = await supabase
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('role', 'student');

  if (enrolledError) {
    throw new Error(`Failed to load enrollments: ${enrolledError.message}`);
  }

  const { data: alreadyGrouped, error: groupedError } = await supabase
    .from('project_group_members')
    .select('user_id')
    .eq('project_id', projectId);

  if (groupedError) {
    throw new Error(`Failed to load project members: ${groupedError.message}`);
  }

  const groupedSet = new Set((alreadyGrouped ?? []).map((row) => row.user_id as string));

  return (enrolled ?? [])
    .map((row) => row.user_id as string)
    .filter((userId) => !groupedSet.has(userId));
}

export async function createProjectGroup(projectId: string, capacity: number, index: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('project_groups')
    .insert({
      project_id: projectId,
      name: `Group ${index}`,
      capacity,
    })
    .select('id, name, capacity')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create group: ${error?.message ?? 'No data returned'}`);
  }

  return data as GroupRow;
}

export async function assignMembersToGroup(projectId: string, groupId: string, userIds: string[]) {
  if (userIds.length === 0) return;

  const supabase = getSupabaseAdmin();
  const payload = userIds.map((userId) => ({
    project_id: projectId,
    group_id: groupId,
    user_id: userId,
  }));

  const { error } = await supabase.from('project_group_members').insert(payload);
  if (error) {
    throw new Error(`Failed to assign members: ${error.message}`);
  }
}

export function splitIntoChunks<T>(arr: T[], chunkSize: number) {
  if (chunkSize <= 0) return [arr];

  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function resolveCourseIdByGroupId(groupId: string) {
  const supabase = getSupabaseAdmin();

  const { data: group, error: groupError } = await supabase
    .from('project_groups')
    .select('project_id')
    .eq('id', groupId)
    .single();

  if (groupError || !group) {
    throw new Error(`Failed to resolve project from group: ${groupError?.message ?? 'No group found'}`);
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('course_id')
    .eq('id', group.project_id)
    .single();

  if (projectError || !project) {
    throw new Error(`Failed to resolve course from project: ${projectError?.message ?? 'No project found'}`);
  }

  return project.course_id as string;
}
