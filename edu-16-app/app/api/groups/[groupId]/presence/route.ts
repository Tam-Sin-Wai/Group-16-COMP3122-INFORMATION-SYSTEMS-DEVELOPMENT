import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const body = (await request.json()) as {
      userId?: string;
      lastSeenAt?: string;
    };

    const userId = (body.userId ?? '').trim();
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const lastSeenAt = body.lastSeenAt ?? new Date().toISOString();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('group_member_presence')
      .upsert(
        {
          group_id: groupId,
          user_id: userId,
          last_seen_at: lastSeenAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'group_id,user_id' },
      )
      .select('group_id, user_id, last_seen_at, updated_at')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ presence: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update presence';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
