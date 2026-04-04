import { getCourseById } from '@/lib/courseData';

const CREATED_BY = '550e8400-e29b-41d4-a716-446655440001';
const STUDENT_ID = '550e8400-e29b-41d4-a716-446655440101';
const GRADED_BY = '550e8400-e29b-41d4-a716-446655440001';

export function isMissingTableError(message: string) {
  const m = message.toLowerCase();
  return m.includes('schema cache') && m.includes('could not find the table');
}

export function getFallbackMaterials(courseId: string) {
  const course = getCourseById(courseId);
  return course.resources.map((resource, index) => {
    const baseTime = new Date(Date.UTC(2026, 0, 1 + index, 8, 0, 0)).toISOString();
    return {
      id: `fallback-material-${course.id}-${index + 1}`,
      course_id: course.id,
      title: resource.title,
      type: resource.type,
      description: resource.content,
      url: null,
      file_path: null,
      uploaded_by: null,
      created_at: baseTime,
      updated_at: baseTime,
    };
  });
}

export function getFallbackAssignments(courseId: string) {
  const base = new Date(Date.UTC(2026, 3, 20, 12, 0, 0));
  return [
    {
      id: `fallback-assignment-${courseId}-1`,
      course_id: courseId,
      title: 'Weekly Reflection',
      description: 'Write a short reflection based on this week lecture and class discussion.',
      due_date: new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      max_marks: 20,
      status: 'active',
      created_by: CREATED_BY,
      created_at: base.toISOString(),
      updated_at: base.toISOString(),
    },
    {
      id: `fallback-assignment-${courseId}-2`,
      course_id: courseId,
      title: 'Mini Project Draft',
      description: 'Submit draft scope, key requirements, and implementation approach.',
      due_date: new Date(base.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString(),
      max_marks: 30,
      status: 'active',
      created_by: CREATED_BY,
      created_at: base.toISOString(),
      updated_at: base.toISOString(),
    },
  ];
}

export function getFallbackGrades(courseId: string) {
  const createdAt = new Date(Date.UTC(2026, 2, 28, 10, 0, 0)).toISOString();
  return [
    {
      id: `fallback-grade-${courseId}-1`,
      course_id: courseId,
      user_id: STUDENT_ID,
      assignment_id: null,
      marks_obtained: 84,
      max_marks: 100,
      percentage: 84,
      feedback: 'Strong understanding. Improve structure clarity in final submission.',
      graded_by: GRADED_BY,
      created_at: createdAt,
      updated_at: createdAt,
    },
  ];
}
