import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getErrorMessage, isMissingSupabaseConfigError } from '@/lib/errorHandler';

const BUCKET = 'documents';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId') || 'comp3122';
    const prefix = `courses/${courseId}`;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'updated_at', order: 'desc' },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const files = (data || [])
      .filter((item) => item.name && !item.name.endsWith('/'))
      .map((item) => {
        const path = `${prefix}/${item.name}`;
        const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        return {
          name: item.name,
          path,
          url: publicData.publicUrl,
          updated_at: item.updated_at,
          created_at: item.created_at,
        };
      });

    return NextResponse.json({ files });
  } catch (error) {
    const message = getErrorMessage(error);
    if (isMissingSupabaseConfigError(message)) {
      return NextResponse.json({ files: [], fallback: true });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
