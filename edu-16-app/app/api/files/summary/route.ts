import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const BUCKET = 'documents';
const MAX_BYTES = 200_000;
const MAX_PDF_BYTES = 5_000_000;
const MAX_CHARS = 6000;
const OCR_PAGE_LIMIT = 3;
const IS_VERCEL = process.env.VERCEL === '1';

export const runtime = 'nodejs';
const execFileAsync = promisify(execFile);

function getExtension(path: string) {
  const name = path.split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

function isReadableTextExtension(ext: string) {
  return [
    'txt',
    'md',
    'markdown',
    'csv',
    'tsv',
    'json',
    'yaml',
    'yml',
    'xml',
    'html',
    'htm',
    'log',
    'sql',
  ].includes(ext);
}

function isUnsupportedBinaryExtension(ext: string) {
  return ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'rar', '7z', 'png', 'jpg', 'jpeg'].includes(ext);
}

async function extractPdfText(bytes: Uint8Array) {
  try {
    const mod = await import('pdf-parse');
    const pdfParse = (mod as { default?: (input: Buffer) => Promise<{ text?: string }> }).default;
    if (!pdfParse) return '';
    const parsed = await pdfParse(Buffer.from(bytes));
    return (parsed.text || '').trim();
  } catch {
    return '';
  }
}

async function extractPdfTextWithPdfjs(bytes: Uint8Array) {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = (pdfjs as { getDocument: (init: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> }> } }).getDocument({
      data: bytes,
    });
    const doc = await task.promise;
    const pages = Math.min(doc.numPages, 20);
    const parts: string[] = [];

    for (let i = 1; i <= pages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'str' in item) {
            const value = (item as { str?: unknown }).str;
            return typeof value === 'string' ? value : '';
          }
          return '';
        })
        .join(' ')
        .trim();
      if (text) parts.push(text);
    }

    return parts.join('\n').trim();
  } catch {
    return '';
  }
}

async function extractPdfTextFromPublicUrl(publicUrl: string) {
  try {
    const normalized = publicUrl.replace(/^https?:\/\//, '');
    const readerUrl = `https://r.jina.ai/http://${normalized}`;
    const response = await fetch(readerUrl, {
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.1',
      },
      cache: 'no-store',
    });

    if (!response.ok) return '';
    const text = (await response.text()).trim();
    if (!text) return '';

    // r.jina.ai can return wrappers; keep it simple and return raw content.
    return text;
  } catch {
    return '';
  }
}

async function extractPdfTextWithPdftotext(bytes: Uint8Array) {
  const base = `summary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pdfPath = path.join(tmpdir(), `${base}.pdf`);

  try {
    await fs.writeFile(pdfPath, Buffer.from(bytes));
    const { stdout } = await execFileAsync('pdftotext', ['-layout', '-nopgbrk', pdfPath, '-'], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return (stdout || '').trim();
  } catch {
    return '';
  } finally {
    await fs.rm(pdfPath, { force: true });
  }
}

async function extractPdfTextWithOcr(bytes: Uint8Array) {
  const base = `summary-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pdfPath = path.join(tmpdir(), `${base}.pdf`);
  const imagePrefix = path.join(tmpdir(), `${base}-page`);

  try {
    await fs.writeFile(pdfPath, Buffer.from(bytes));

    // Render first few pages to images, then OCR each page.
    await execFileAsync('pdftoppm', ['-f', '1', '-l', String(OCR_PAGE_LIMIT), '-r', '180', '-png', pdfPath, imagePrefix], {
      maxBuffer: 8 * 1024 * 1024,
    });

    const allFiles = await fs.readdir(tmpdir());
    const imageFiles = allFiles
      .filter((name) => name.startsWith(`${base}-page-`) && name.endsWith('.png'))
      .sort((a, b) => a.localeCompare(b));

    if (imageFiles.length === 0) return '';

    const chunks: string[] = [];
    for (const imageFile of imageFiles) {
      const imagePath = path.join(tmpdir(), imageFile);
      try {
        const { stdout } = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '6'], {
          maxBuffer: 8 * 1024 * 1024,
        });
        if (stdout?.trim()) chunks.push(stdout.trim());
      } catch {
        // Continue OCR on other pages even if one page fails.
      }
    }

    return chunks.join('\n\n').trim();
  } catch {
    return '';
  } finally {
    await fs.rm(pdfPath, { force: true });
    const allFiles = await fs.readdir(tmpdir());
    const imageFiles = allFiles.filter((name) => name.startsWith(`${base}-page-`) && name.endsWith('.png'));
    await Promise.all(imageFiles.map((name) => fs.rm(path.join(tmpdir(), name), { force: true })));
  }
}

function printableRatio(text: string) {
  if (!text) return 0;
  let printable = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isWhitespace = code === 9 || code === 10 || code === 13 || code === 32;
    const isBasic = code >= 33 && code <= 126;
    const isCjk = code >= 0x4e00 && code <= 0x9fff;
    if (isWhitespace || isBasic || isCjk) printable += 1;
  }
  return printable / text.length;
}

function hasTooManyReplacementChars(text: string) {
  if (!text) return false;
  const replacement = (text.match(/�/g) || []).length;
  return replacement / text.length > 0.03;
}

function likelyBinary(bytes: Uint8Array) {
  if (bytes.length === 0) return false;
  let zeroCount = 0;
  const sampleLen = Math.min(bytes.length, 4096);
  for (let i = 0; i < sampleLen; i += 1) {
    if (bytes[i] === 0) zeroCount += 1;
  }
  return zeroCount / sampleLen > 0.01;
}

function decodeText(bytes: Uint8Array) {
  const encodings = ['utf-8', 'utf-16le', 'gb18030', 'big5'];
  let best = '';
  let bestScore = -1;

  for (const enc of encodings) {
    try {
      const decoded = new TextDecoder(enc as BufferEncoding, { fatal: false }).decode(bytes);
      const score = printableRatio(decoded) - (hasTooManyReplacementChars(decoded) ? 0.2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = decoded;
      }
    } catch {
      // Ignore unsupported decoder in this runtime.
    }
  }

  return best;
}

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

    const ext = getExtension(path);
    const bytes = new Uint8Array(await data.arrayBuffer());

    if (ext === 'pdf') {
      const pdfBytes = bytes.slice(0, MAX_PDF_BYTES);
      const fromLibrary = await extractPdfText(pdfBytes);
      const fromPdfjs = fromLibrary ? '' : await extractPdfTextWithPdfjs(pdfBytes);
      const fromPdftotext = fromLibrary || fromPdfjs || IS_VERCEL ? '' : await extractPdfTextWithPdftotext(pdfBytes);
      const fromOcr = fromLibrary || fromPdfjs || fromPdftotext || IS_VERCEL ? '' : await extractPdfTextWithOcr(pdfBytes);
      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const fromRemote = fromLibrary || fromPdfjs || fromPdftotext || fromOcr ? '' : await extractPdfTextFromPublicUrl(publicUrl);
      const pdfText = fromLibrary || fromPdfjs || fromPdftotext || fromOcr || fromRemote;

      if (!pdfText || printableRatio(pdfText) < 0.45) {
        return NextResponse.json({
          summary:
            'Unable to extract readable text from this PDF. It may be scanned images only or protected. ' +
            (IS_VERCEL
              ? 'On Vercel, scanned PDFs need pre-OCR conversion before upload.'
              : 'Try uploading a text-based export or OCR version of this PDF.'),
        });
      }
      const summary = naiveSummary(pdfText.slice(0, MAX_CHARS));
      return NextResponse.json({ summary });
    }

    if (isUnsupportedBinaryExtension(ext)) {
      return NextResponse.json({
        summary:
          `This file type (.${ext}) is binary and cannot be summarized with the current parser. ` +
          'Please upload a text-based file (txt, md, csv, json) or convert this file to plain text first.',
      });
    }

    const limitedBytes = bytes.slice(0, MAX_BYTES);

    if (likelyBinary(limitedBytes) && !isReadableTextExtension(ext)) {
      return NextResponse.json({
        summary:
          'The uploaded file appears to be binary content, so text extraction failed. ' +
          'Please upload a text-based file for summarization.',
      });
    }

    const decoded = decodeText(limitedBytes);
    if (!decoded || printableRatio(decoded) < 0.5 || hasTooManyReplacementChars(decoded)) {
      return NextResponse.json({
        summary:
          'Text decoding quality is too low, likely due to unsupported file encoding or binary format. ' +
          'Try UTF-8 text files (txt/md/csv/json) for stable summaries.',
      });
    }

    const summary = naiveSummary(decoded.slice(0, MAX_CHARS));

    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summary failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
