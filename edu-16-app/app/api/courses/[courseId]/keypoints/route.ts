import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getCourseById } from '@/lib/courseData';
import { askOpenAI } from '@/lib/virtualTeacher';
import { getErrorMessage } from '@/lib/errorHandler';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = getSupabaseServer();
  try {
    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'revision'; // revision, exam, summary

    const course = getCourseById(courseId);
    const courseContext = course.resources
      .map((resource) => `[${resource.type}] ${resource.title}: ${resource.content}`)
      .join('\n');

    const systemPrompt = `You are an AI assistant that creates study materials for university courses.
Based on the provided course materials, generate ${type} keypoints for revision.
Focus on the most important concepts, definitions, and relationships.
Structure the output as a JSON object with:
{
  "title": "Key Points for [Course Name]",
  "sections": [
    {
      "title": "Section Name",
      "points": ["Key point 1", "Key point 2", ...]
    }
  ]
}

Make it comprehensive but concise. Use only the provided course context.`;

    const userPrompt = `Course: ${course.code} ${course.name}
Materials:
${courseContext}

Generate ${type} keypoints for revision.`;

    const aiResponse = await askOpenAI(systemPrompt, userPrompt);
    if (!aiResponse) {
      return NextResponse.json({ error: 'Failed to generate keypoints' }, { status: 500 });
    }

    let keypointsData;
    try {
      keypointsData = JSON.parse(aiResponse);
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid keypoints format generated' }, { status: 500 });
    }

    return NextResponse.json({ keypoints: keypointsData });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}