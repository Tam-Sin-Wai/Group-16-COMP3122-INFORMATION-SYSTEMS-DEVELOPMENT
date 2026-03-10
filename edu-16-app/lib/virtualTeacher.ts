import type { Course } from '@/lib/courseData';

export function buildCourseContext(course: Course) {
  const resourceText = course.resources
    .map((resource) => `[${resource.type}] ${resource.title}: ${resource.content}`)
    .join('\n');

  return [
    `Course: ${course.code} ${course.name}`,
    `Lecturer: ${course.lecturer}`,
    `Objective: ${course.objective}`,
    `Assessment Criteria: ${course.assessmentCriteria.join('; ')}`,
    'Knowledge Base:',
    resourceText,
  ].join('\n');
}

export function fallbackTeacherReply(course: Course, studentQuestion: string) {
  const criteria = course.assessmentCriteria
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');

  return [
    `Great question for ${course.code}.`,
    '',
    'Based on the course context, here is a focused response:',
    `- Key concept: ${course.resources[0]?.content ?? 'Review the latest lecture summary for key concepts.'}`,
    `- Lecturer emphasis: ${course.resources[1]?.content ?? 'Check the lecture transcript for framing and examples.'}`,
    `- Assignment alignment: ${course.resources[2]?.content ?? 'Follow the assignment guideline structure and explicit criteria.'}`,
    `- Discussion pulse: ${course.resources[3]?.content ?? 'Use class discussion trends to validate your interpretation.'}`,
    '',
    'Suggested way to answer in your own words:',
    `- Start by defining the concept in relation to the question: "${studentQuestion}".`,
    '- Connect one lecture insight to one practical example.',
    '- Close with why this matters for decision quality or critical thinking in this course.',
    '',
    'Assessment checklist reminder:',
    criteria,
    '',
    'Academic integrity note: I can guide your structure and reasoning, but final wording and referencing should be your own work.',
  ].join('\n');
}

export async function askOpenAI(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = payload.choices?.[0]?.message?.content?.trim();
  return text || null;
}
