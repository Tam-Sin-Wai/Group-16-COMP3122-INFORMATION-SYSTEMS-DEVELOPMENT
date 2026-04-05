import { NextResponse } from 'next/server';
import { getCourseById } from '@/lib/courseData';
import { askOpenAI, buildCourseContext } from '@/lib/virtualTeacher';
import { getErrorMessage } from '@/lib/errorHandler';

type StudentHistoryItem = {
  title: string;
  activityType: string;
  score: number;
};

type LabLayout = {
  id: string;
  name: string;
  description: string;
  compareFocus: string;
};

type InteractiveLabResponse = {
  mode: 'lab' | 'quiz';
  title: string;
  summary: string;
  reason: string;
  personalizationHint: string;
  lab?: {
    objective: string;
    comparePrompt: string;
    layouts: LabLayout[];
    studentSteps: string[];
    ratingScale: string[];
    reflectionQuestions: string[];
  };
  quiz?: {
    suggestedPrompt: string;
    note: string;
  };
};

function isLabFriendly(instruction: string) {
  const lower = instruction.toLowerCase();
  return /(ui|layout|design|prototype|compare|critique|interaction|workflow|simulation|scenario|debug|experience|visual|storyboard|interface|tutorial|game)/.test(lower);
}

function buildStudentHistorySummary(history: StudentHistoryItem[]) {
  if (history.length === 0) {
    return 'No recent student reaction history is available.';
  }

  const sorted = [...history].sort((a, b) => b.score - a.score).slice(0, 5);
  const average = Math.round(sorted.reduce((sum, item) => sum + item.score, 0) / sorted.length);

  return [
    `Recent average score: ${average}%`,
    'Recent activity history:',
    ...sorted.map((item) => `- ${item.title} (${item.activityType}): ${item.score}%`),
  ].join('\n');
}

function fallbackLabResponse(courseName: string, instruction: string, historySummary: string): InteractiveLabResponse {
  const lower = instruction.toLowerCase();
  const labMode = isLabFriendly(instruction);

  if (!labMode) {
    return {
      mode: 'quiz',
      title: `${courseName} Quiz Suggestion`,
      summary: 'This topic is better suited to a quiz-style review than a live interactive lab.',
      reason: 'The topic is mostly factual or procedural, so a quiz will work better than a game-style activity.',
      personalizationHint: historySummary,
      quiz: {
        suggestedPrompt: `Generate a ${courseName} quiz that checks core concepts, includes short explanations, and adapts difficulty based on prior student performance.`,
        note: 'Use the existing Generate Test function for this prompt.',
      },
    };
  }

  const layoutTheme = lower.includes('ui') || lower.includes('interface') || lower.includes('visual')
    ? 'UI layout'
    : 'interactive learning';

  return {
    mode: 'lab',
    title: `${courseName} Interactive Lab`,
    summary: 'A compact compare-and-rate lab that asks students to evaluate two or three interaction patterns before reflecting on the best choice.',
    reason: 'The topic supports comparison, critique, and guided reflection, which works well as a self-learning lab.',
    personalizationHint: historySummary,
    lab: {
      objective: `Help students compare ${layoutTheme} options for ${courseName} and explain why one approach is stronger for the stated learning goal.`,
      comparePrompt: instruction,
      layouts: [
        {
          id: 'layout-a',
          name: 'Focused layout',
          description: 'A compact design with one clear action path and minimal visual noise.',
          compareFocus: 'Best for first-time learners and fast comprehension.',
        },
        {
          id: 'layout-b',
          name: 'Guided layout',
          description: 'A step-by-step design that explains each action before the student interacts.',
          compareFocus: 'Best for feedback-driven practice and concept reinforcement.',
        },
        {
          id: 'layout-c',
          name: 'Exploration layout',
          description: 'A richer design that lets students try multiple paths and compare results.',
          compareFocus: 'Best for advanced students and deeper exploration.',
        },
      ],
      studentSteps: [
        'Preview each layout and identify what the learner sees first.',
        'Rate each option from 1 to 5 for clarity and usefulness.',
        'Pick the layout you would ship to students and justify the choice.',
      ],
      ratingScale: [
        '1 = confusing or overloaded',
        '3 = acceptable but not memorable',
        '5 = clear, engaging, and easy to learn from',
      ],
      reflectionQuestions: [
        'Which layout lowers friction the most for your audience?',
        'Which layout would work better for students who need extra guidance?',
        'How would you improve the strongest layout even further?',
      ],
    },
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params;
    const body = (await request.json()) as {
      instruction?: string;
      history?: StudentHistoryItem[];
      averageScore?: number | null;
    };

    const instruction = (body.instruction || '').trim();
    const history = body.history || [];

    if (!instruction) {
      return NextResponse.json({ error: 'Instruction is required' }, { status: 400 });
    }

    const course = getCourseById(courseId);
    const courseContext = buildCourseContext(course);
    const historySummary = buildStudentHistorySummary(history);

    const systemPrompt = [
      'You are an AI instructional designer for university courses.',
      'Decide whether the request should become an interactive lab/tutorial or a quiz fallback.',
      'Use an interactive lab when students can compare layouts, critique designs, test workflows, or reflect on a guided scenario.',
      'Use a quiz fallback when the request is mostly factual, procedural, or not suitable for a simple game-like interaction.',
      'Return pure JSON only using this shape:',
      '{',
      '  "mode": "lab" | "quiz",',
      '  "title": string,',
      '  "summary": string,',
      '  "reason": string,',
      '  "personalizationHint": string,',
      '  "lab"?: {',
      '    "objective": string,',
      '    "comparePrompt": string,',
      '    "layouts": [{ "id": string, "name": string, "description": string, "compareFocus": string }],',
      '    "studentSteps": string[],',
      '    "ratingScale": string[],',
      '    "reflectionQuestions": string[]',
      '  },',
      '  "quiz"?: {',
      '    "suggestedPrompt": string,',
      '    "note": string',
      '  }',
      '}',
      'Keep it short, practical, and suitable for a teacher to reuse immediately.',
      '',
      courseContext,
      '',
      `Student reaction history:\n${historySummary}`,
    ].join('\n');

    const userPrompt = [
      `Course: ${course.code} ${course.name}`,
      `Teacher request: ${instruction}`,
      'Make the result tailored to the course and the history above.',
      'If you choose quiz fallback, explicitly tell the teacher to use the existing Generate Test function.',
    ].join('\n\n');

    const aiResponse = await askOpenAI(systemPrompt, userPrompt);

    if (aiResponse) {
      try {
        const parsed = JSON.parse(aiResponse) as InteractiveLabResponse;
        if (parsed && (parsed.mode === 'lab' || parsed.mode === 'quiz')) {
          return NextResponse.json({ ...parsed, source: 'openai' });
        }
      } catch {
        // Fall through to local fallback.
      }
    }

    const fallback = fallbackLabResponse(course.name, instruction, historySummary);
    return NextResponse.json({ ...fallback, source: 'fallback' });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}