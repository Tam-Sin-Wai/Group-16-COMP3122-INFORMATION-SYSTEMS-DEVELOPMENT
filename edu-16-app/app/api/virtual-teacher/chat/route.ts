import { NextResponse } from 'next/server';
import { getCourseById } from '@/lib/courseData';
import { askOpenAI, buildCourseContext, fallbackTeacherReply } from '@/lib/virtualTeacher';
import { getSupabaseServer } from '@/lib/supabaseServer';

const BUCKET = 'documents';
const MAX_FILES = 4;
const MAX_FILE_BYTES = 300_000;
const MAX_EXCERPT_CHARS = 1600;

export const runtime = 'nodejs';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function getExtension(filePath: string) {
  const name = filePath.split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

function isTextExtension(ext: string) {
  return ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'html', 'htm', 'log', 'sql'].includes(ext);
}

function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

async function extractPdfText(bytes: Uint8Array) {
  try {
    const mod = await import('pdf-parse');
    const pdfParse = (mod as { default?: (input: Buffer) => Promise<{ text?: string }> }).default;
    if (!pdfParse) return '';
    const parsed = await pdfParse(Buffer.from(bytes));
    return cleanText(parsed.text || '');
  } catch {
    return '';
  }
}

function extractTextByEncoding(bytes: Uint8Array) {
  const encodings = ['utf-8', 'utf-16le', 'gb18030', 'big5'];
  let best = '';
  for (const enc of encodings) {
    try {
      const decoded = new TextDecoder(enc).decode(bytes);
      if (decoded.length > best.length) best = decoded;
    } catch {
      // Ignore unsupported encoding in this runtime.
    }
  }
  return cleanText(best);
}

async function buildUploadedFileContext(courseId: string) {
  try {
    const supabase = getSupabaseServer();
    const prefix = `courses/${courseId}`;
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'updated_at', order: 'desc' },
    });

    if (error || !data) return '';

    const fileEntries = data.filter((item) => item.name && !item.name.endsWith('/') && !item.name.startsWith('.'));

    if (fileEntries.length === 0) return '';

    const snippets: string[] = [];

    for (const item of fileEntries) {
      const fullPath = `${prefix}/${item.name}`;
      const ext = getExtension(item.name);
      const { data: blob } = await supabase.storage.from(BUCKET).download(fullPath);
      if (!blob) continue;

      const bytes = new Uint8Array(await blob.arrayBuffer()).slice(0, MAX_FILE_BYTES);
      let extracted = '';

      if (ext === 'pdf') {
        extracted = await extractPdfText(bytes);
      } else if (isTextExtension(ext)) {
        extracted = extractTextByEncoding(bytes);
      } else {
        continue;
      }

      if (!extracted) continue;

      snippets.push(`Source: ${item.name}\nExcerpt: ${extracted.slice(0, MAX_EXCERPT_CHARS)}`);
      if (snippets.length >= MAX_FILES) break;
    }

    if (snippets.length === 0) return '';

    return ['Uploaded Knowledge Base (prefer these sources when relevant):', ...snippets].join('\n\n');
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseServer();
  try {
    const body = (await request.json()) as {
      courseId?: string;
      message?: string;
      history?: ChatMessage[];
      userId?: string;
    };

    const courseId = body.courseId || 'comp3122';
    const message = (body.message || '').trim();
    const history = body.history || [];
    const userId = body.userId;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const course = getCourseById(courseId);
    const courseContext = buildCourseContext(course);
    const uploadedContext = await buildUploadedFileContext(courseId);
    const compactHistory = history
      .slice(-6)
      .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
      .join('\n');

    const systemPrompt = [
      'You are a virtual teacher for a university course.',
      'Use only the provided course context. If context is insufficient, state limitations clearly.',
      'When uploaded sources exist, prioritize uploaded file excerpts over static defaults and mention source filename briefly.',
      'Support theory explanation, non-open factual questions, assignment structure guidance, and course tool engagement summary.',
      'Use conversational but professional tone. Prefer concise bullet points when appropriate.',
      'Do not write complete assignment answers for direct submission. Preserve academic integrity.',
      '',
      courseContext,
      uploadedContext ? `\n${uploadedContext}` : '\nNo uploaded file context found for this course.',
    ].join('\n');

    const userPrompt = [
      compactHistory ? `Conversation history:\n${compactHistory}` : 'No prior messages.',
      `Student question: ${message}`,
    ].join('\n\n');

    const aiResponse = await askOpenAI(systemPrompt, userPrompt);
    const baseFallback = fallbackTeacherReply(course, message);
    const sourceLines = uploadedContext
      .split('\n')
      .filter((line) => line.startsWith('Source: '))
      .slice(0, 3);

    const fallbackWithUploads = sourceLines.length
      ? `${baseFallback}\n\nUploaded sources used:\n${sourceLines.map((line) => `- ${line.replace('Source: ', '')}`).join('\n')}`
      : baseFallback;

    const response = aiResponse || fallbackWithUploads;

    // Log the interaction for FAQ tracking
    try {
      await supabase.from('virtual_teacher_logs').insert({
        course_id: courseId,
        user_id: userId,
        question: message,
        response: response,
        response_source: aiResponse ? 'openai' : 'fallback',
      });

      // Update or insert FAQ frequency
      const { data: existingFAQ } = await supabase
        .from('frequently_asked_questions')
        .select('id, frequency')
        .eq('course_id', courseId)
        .eq('question', message)
        .single();

      if (existingFAQ) {
        await supabase
          .from('frequently_asked_questions')
          .update({
            frequency: existingFAQ.frequency + 1,
            last_asked: new Date().toISOString(),
          })
          .eq('id', existingFAQ.id);
      } else {
        await supabase.from('frequently_asked_questions').insert({
          course_id: courseId,
          question: message,
          answer: response,
          frequency: 1,
        });
      }
    } catch (logError) {
      // Don't fail the response if logging fails
      console.error('Failed to log virtual teacher interaction:', logError);
    }

    return NextResponse.json({ response, source: aiResponse ? 'openai' : 'fallback' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
