import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const BUCKET = 'documents';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { path?: string; courseId?: string };
    const path = body.path || '';
    const courseId = body.courseId || 'comp3122';

    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    const allowedPrefix = `courses/${courseId}/`;
    if (!path.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: 'Path outside selected course' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
