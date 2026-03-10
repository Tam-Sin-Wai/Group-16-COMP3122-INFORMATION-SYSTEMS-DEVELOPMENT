import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function toOnlineStatus(lastSeenAt: string | null) {
  if (!lastSeenAt) return { isOnline: false, lastSeenAt: null };

  const ts = new Date(lastSeenAt).getTime();
  const isOnline = Date.now() - ts <= ONLINE_THRESHOLD_MS;
  return { isOnline, lastSeenAt };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: members, error: membersError } = await supabase
      .from('project_group_members')
      .select('user_id, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (membersError) throw new Error(membersError.message);

    const userIds = (members ?? []).map((item) => item.user_id as string);
    if (userIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds);

    if (profileError) throw new Error(profileError.message);

    const { data: presenceRows, error: presenceError } = await supabase
      .from('group_member_presence')
      .select('user_id, last_seen_at')
      .eq('group_id', groupId)
      .in('user_id', userIds);

    if (presenceError) throw new Error(presenceError.message);

    const profileMap = new Map((profiles ?? []).map((row) => [row.id as string, row]));
    const presenceMap = new Map((presenceRows ?? []).map((row) => [row.user_id as string, row.last_seen_at as string]));

    const response = (members ?? []).map((member) => {
      const userId = member.user_id as string;
      const profile = profileMap.get(userId);
      const lastSeenAt = presenceMap.get(userId) ?? null;
      return {
        userId,
        displayName: profile?.display_name ?? 'Student',
        email: profile?.email ?? null,
        joinedAt: member.joined_at,
        ...toOnlineStatus(lastSeenAt),
      };
    });

    return NextResponse.json({ members: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load members';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
