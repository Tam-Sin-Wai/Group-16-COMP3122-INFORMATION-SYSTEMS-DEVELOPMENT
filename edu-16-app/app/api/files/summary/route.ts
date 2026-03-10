import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const BUCKET = 'documents';

function naiveSummary(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No readable text found in this file.';

  const chunks = normalized.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 5);
  const points = chunks.map((line) => `- ${line}`).join('\n');

  return [
    'Quick summary from uploaded content:',
    points || '- The file appears to contain very short content.',
    '',
    'Tip: Upload lecture summaries or transcript text files for richer AI responses.',
  ].join('\n');
}

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
    const { data, error } = await supabase.storage.from(BUCKET).download(path);

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Cannot download file' }, { status: 500 });
    }

    const fileText = await data.text();
    const summary = naiveSummary(fileText.slice(0, 6000));

    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summary failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
