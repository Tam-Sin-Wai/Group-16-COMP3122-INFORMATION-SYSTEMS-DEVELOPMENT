export type CourseResource = {
  type: 'lecture_summary' | 'transcript' | 'assignment_guideline' | 'padlet';
  title: string;
  content: string;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  lecturer: string;
  objective: string;
  assessmentCriteria: string[];
  resources: CourseResource[];
};

export const COURSES: Course[] = [
  {
    id: 'comp3122',
    code: 'COMP3122',
    name: 'Information Systems Development',
    lecturer: 'Dr. Chan',
    objective:
      'Develop critical thinking in information systems design, implementation strategy, and reflective evaluation of technology choices.',
    assessmentCriteria: [
      'Relevance to the scenario and stakeholder needs',
      'Logical cohesion and argument flow',
      'Evidence-based reasoning with proper referencing',
      'Feasibility of design decisions and implementation plan',
    ],
    resources: [
      {
        type: 'lecture_summary',
        title: 'Week 1 Summary',
        content:
          'Student-centered information systems emphasize iterative feedback loops, user empathy, and measurable learning outcomes.',
      },
      {
        type: 'transcript',
        title: 'Lecture Recording Notes',
        content:
          'The lecturer highlighted that requirements elicitation must connect business goals, user pain points, and technical constraints.',
      },
      {
        type: 'assignment_guideline',
        title: 'Assignment 1 Guidelines',
        content:
          'Students should structure their report with context, problem statement, solution architecture, trade-off analysis, and references in APA style.',
      },
      {
        type: 'padlet',
        title: 'Padlet Discussion Highlights',
        content:
          'Common class concerns include scope control, balancing innovation with practicality, and choosing realistic datasets for prototypes.',
      },
    ],
  },
  {
    id: 'comp4107',
    code: 'COMP4107',
    name: 'Human Computer Interaction',
    lecturer: 'Prof. Wong',
    objective:
      'Apply user-centered design, usability evaluation, and inclusive interaction principles in digital product development.',
    assessmentCriteria: [
      'Depth of user research and persona quality',
      'Consistency of interaction patterns',
      'Quality of usability evaluation and interpretation',
      'Clarity of design rationale with references',
    ],
    resources: [
      {
        type: 'lecture_summary',
        title: 'Week 2 Summary',
        content:
          'Effective interfaces reduce cognitive load through recognition-based navigation, clear affordances, and progressive disclosure.',
      },
      {
        type: 'transcript',
        title: 'Studio Crit Transcript',
        content:
          'The class discussed accessibility as a baseline requirement, not an optional enhancement.',
      },
      {
        type: 'assignment_guideline',
        title: 'Design Critique Brief',
        content:
          'Critiques should map UI decisions to heuristics, user goals, and task completion metrics.',
      },
      {
        type: 'padlet',
        title: 'Padlet Sprint Reflection',
        content:
          'Teams shared wireframe iterations and identified onboarding friction in mobile-first layouts.',
      },
    ],
  },
  {
    id: 'comp2202',
    code: 'COMP2202',
    name: 'Database Systems',
    lecturer: 'Dr. Lee',
    objective:
      'Build robust data models and justify database decisions with attention to integrity, performance, and maintainability.',
    assessmentCriteria: [
      'Correct normalization and schema consistency',
      'Appropriate indexing and query strategy',
      'Data integrity and constraints design',
      'Accurate citation of references and examples',
    ],
    resources: [
      {
        type: 'lecture_summary',
        title: 'Week 4 Summary',
        content:
          'Normalization reduces redundancy, but practical systems also require selective denormalization for read-heavy workloads.',
      },
      {
        type: 'transcript',
        title: 'Query Optimization Lecture',
        content:
          'The lecturer compared nested loop joins and hash joins, emphasizing cardinality estimation impacts.',
      },
      {
        type: 'assignment_guideline',
        title: 'Mini Project Spec',
        content:
          'Document ER model assumptions, justify schema choices, and include SQL evidence for key requirements.',
      },
      {
        type: 'padlet',
        title: 'Padlet SQL Clinic',
        content:
          'Students discussed common mistakes in grouping queries and foreign key update cascades.',
      },
    ],
  },
];

export function getCourseById(courseId: string) {
  return COURSES.find((course) => course.id === courseId) ?? COURSES[0];
}
