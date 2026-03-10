import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const BUCKET = 'documents';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      oldPath?: string;
      newPath?: string;
      courseId?: string;
    };

    const oldPath = body.oldPath || '';
    const newPath = body.newPath || '';
    const courseId = body.courseId || 'comp3122';

    if (!oldPath || !newPath) {
      return NextResponse.json({ error: 'Missing oldPath or newPath' }, { status: 400 });
    }

    const allowedPrefix = `courses/${courseId}/`;
    if (!oldPath.startsWith(allowedPrefix) || !newPath.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: 'Path outside selected course' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { error: copyError } = await supabase.storage.from(BUCKET).copy(oldPath, newPath);
    if (copyError) {
      return NextResponse.json({ error: copyError.message }, { status: 500 });
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([oldPath]);
    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, newPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rename failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
