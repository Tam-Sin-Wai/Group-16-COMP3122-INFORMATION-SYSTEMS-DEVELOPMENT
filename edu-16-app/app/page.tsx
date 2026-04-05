'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { COURSES } from '@/lib/courseData';

type FileItem = {
  name: string;
  path: string;
  url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type CourseMaterial = {
  id: string;
  course_id: string;
  title: string;
  type: 'lecture_summary' | 'transcript' | 'assignment_guideline' | 'padlet' | 'other';
  description?: string;
  url?: string;
  file_path?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
};

type Assignment = {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  due_date: string;
  max_marks: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Grade = {
  id: string;
  course_id: string;
  user_id: string;
  assignment_id?: string;
  marks_obtained: number;
  max_marks: number;
  percentage: number;
  feedback?: string;
  graded_by?: string;
  created_at: string;
  updated_at: string;
};

type ProjectItem = {
  id: string;
  course_id: string;
  name: string;
  description?: string | null;
  target_group_size: number;
  max_groups?: number | null;
  status: 'draft' | 'grouping' | 'active' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
};

type GroupItem = {
  id: string;
  project_id: string;
  name: string;
  capacity: number;
  created_at: string;
  members: { user_id: string; joined_at: string }[];
  memberCount: number;
  latestChatAt?: string | null;
};

type TestQuestion = {
  question: string;
  options: string[];
};

type MatchingPair = {
  id: string;
  prompt: string;
  answer: string;
};

type ScenarioChoice = {
  label: string;
  next: number;
};

type ScenarioNode = {
  id: number;
  prompt: string;
  choices: ScenarioChoice[];
};

type ActivityType =
  | 'quiz'
  | 'matching'
  | 'ordering'
  | 'fill-blank'
  | 'scenario'
  | 'speed-challenge'
  | 'classification'
  | 'cause-effect'
  | 'map-label'
  | 'memory'
  | 'debate'
  | 'team-battle';

type TestActivity = {
  id: string;
  title: string;
  instructionSummary: string;
  parentActivityId?: string;
  personalizationNote?: string;
  activityType: ActivityType;
  timeLimitSec?: number;
  questions?: TestQuestion[];
  matchingPairs?: MatchingPair[];
  orderingItems?: string[];
  blankSentence?: string;
  blankOptions?: string[];
  blankAnswers?: string[];
  scenarioNodes?: ScenarioNode[];
  speedQuestions?: TestQuestion[];
  categories?: string[];
  classificationItems?: { id: string; label: string; category: string }[];
  causeEffectPairs?: { cause: string; effect: string }[];
  mapPoints?: { id: string; location: string; label: string }[];
  memoryPairs?: MatchingPair[];
  debateClaim?: string;
  debateEvidence?: { id: string; text: string; supports: boolean }[];
  teamBattleQuestions?: TestQuestion[];
};

type InteractiveLabLayout = {
  id: string;
  name: string;
  description: string;
  compareFocus: string;
};

type InteractiveLabPlan = {
  mode: 'lab' | 'quiz';
  title: string;
  summary: string;
  reason: string;
  personalizationHint: string;
  lab?: {
    objective: string;
    comparePrompt: string;
    layouts: InteractiveLabLayout[];
    studentSteps: string[];
    ratingScale: string[];
    reflectionQuestions: string[];
  };
  quiz?: {
    suggestedPrompt: string;
    note: string;
  };
};

function SortableTimelineItem({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="teacher-timeline-item" {...attributes} {...listeners}>
      <span className="teacher-timeline-handle">⋮⋮</span>
      <span>{label}</span>
    </li>
  );
}

function DraggableAnswer({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: Boolean(disabled),
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: disabled ? 0.45 : isDragging ? 0.75 : 1,
  };

  return (
    <button ref={setNodeRef} style={style} className="teacher-draggable-answer" {...listeners} {...attributes} disabled={disabled}>
      {label}
    </button>
  );
}

function MatchingDropZone({ id, prompt, matchedText }: { id: string; prompt: string; matchedText?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`teacher-drop-zone ${isOver ? 'over' : ''}`}>
      <strong>{prompt}</strong>
      <span>{matchedText || 'Drop answer here'}</span>
    </div>
  );
}

function basename(path: string) {
  if (!path) return path;
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function stripTimestampPrefix(filename: string) {
  return filename.replace(/^\d+-/, '');
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--:-- UTC';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

function formatDateTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

function formatDuration(totalSec: number) {
  const sec = Math.max(0, totalSec);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function getBaseActivityTitle(title: string) {
  return title.replace(/\s+Personalization\s*\d+$/i, '').replace(/\s+Personalization$/i, '').trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

const DEFAULT_TEACHER_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const PRESET_STUDENTS = ['26000000d', '27000000d', '28000000d'] as const;
const PRESET_STUDENT_ID_MAP: Record<string, string> = {
  '26000000d': '550e8400-e29b-41d4-a716-446655440101',
  '27000000d': '550e8400-e29b-41d4-a716-446655440102',
  '28000000d': '550e8400-e29b-41d4-a716-446655440103',
};

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'I am your virtual teacher. Ask about lecture concepts, assignment structure, or Padlet discussion themes for this course.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

type DashboardFeatureKey =
  | 'dashboard'
  | 'virtual-teacher'
  | 'upload-center'
  | 'course-data'
  | 'group-management'
  | 'clibot-edu';

type SidebarPosition = 'left' | 'right';

type FeatureMenuKey = DashboardFeatureKey | 'custom';

const FEATURE_MENU_ITEMS: { id: FeatureMenuKey; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'View course overview, stats, and recent activity.' },
  {
    id: 'virtual-teacher',
    label: 'Virtual Teacher',
    description: 'Chat with AI for course concepts and guidance.',
  },
  {
    id: 'upload-center',
    label: 'Upload Center',
    description: 'Upload, preview, summarize, rename, and delete files.',
  },
  { id: 'course-data', label: 'Course Data', description: 'Browse materials, assignments, and grades.' },
  {
    id: 'group-management',
    label: 'Group Management',
    description: 'Create projects and manage group allocation.',
  },
  {
    id: 'clibot-edu',
    label: 'Clibot Edu',
    description: 'Generate and run AI-powered classroom activities.(Generate Interactive Lab)',
  },
  { id: 'custom', label: 'Custom', description: 'Show multiple selected functions on one page.' },
];

const FEATURE_SEARCH_KEYWORDS: Record<FeatureMenuKey, string[]> = {
  dashboard: ['overview', 'stats', 'recent activity', 'course summary', 'subject'],
  'virtual-teacher': ['chat', 'ai', 'question', 'lecture', 'assignment', 'padlet', 'guidance'],
  'upload-center': ['upload', 'preview', 'summarize', 'rename', 'delete', 'file'],
  'course-data': ['materials', 'assignments', 'grades', 'faq', 'keypoints', 'quiz'],
  'group-management': ['project', 'group', 'allocation', 'student', 'capacity', 'member'],
  'clibot-edu': ['interactive lab', 'generate test', 'quiz', 'matching', 'ordering', 'personalize'],
  custom: ['multi function', 'layout', 'combined view', 'reorder'],
};

const DEFAULT_CUSTOM_LAYOUT: DashboardFeatureKey[] = [
  'dashboard',
  'virtual-teacher',
  'upload-center',
  'course-data',
  'group-management',
  'clibot-edu',
];

type DashboardActivity = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  kind: 'file' | 'material' | 'assignment' | 'grade' | 'project';
};

type DashboardStat = {
  label: string;
  value: string;
  hint: string;
};

function getValidTimestamp(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function buildDashboardActivityFeed(
  selectedCourse: (typeof COURSES)[number],
  files: FileItem[],
  materials: CourseMaterial[],
  assignments: Assignment[],
  grades: Grade[],
  projects: ProjectItem[],
) {
  const feed: DashboardActivity[] = [];

  files.slice(0, 3).forEach((file) => {
    const timestamp = getValidTimestamp(file.updated_at || file.created_at);
    if (!timestamp) return;
    feed.push({
      id: `file-${file.path}`,
      title: 'New file uploaded',
      detail: `${stripTimestampPrefix(basename(file.name || file.path))} is ready in ${selectedCourse.code}`,
      timestamp,
      kind: 'file',
    });
  });

  materials.slice(0, 2).forEach((material) => {
    const timestamp = getValidTimestamp(material.updated_at || material.created_at);
    if (!timestamp) return;
    feed.push({
      id: `material-${material.id}`,
      title: 'Course material added',
      detail: `${material.title} is available for ${selectedCourse.code}`,
      timestamp,
      kind: 'material',
    });
  });

  assignments.slice(0, 2).forEach((assignment) => {
    const timestamp = getValidTimestamp(assignment.updated_at || assignment.created_at);
    if (!timestamp) return;
    feed.push({
      id: `assignment-${assignment.id}`,
      title: 'Assignment published',
      detail: `${assignment.title} is open until ${formatDateTime(assignment.due_date)}`,
      timestamp,
      kind: 'assignment',
    });
  });

  grades.slice(0, 2).forEach((grade) => {
    const timestamp = getValidTimestamp(grade.updated_at || grade.created_at);
    if (!timestamp) return;
    feed.push({
      id: `grade-${grade.id}`,
      title: 'Grade updated',
      detail: `Assessment progress is now ${grade.percentage}% for ${selectedCourse.code}`,
      timestamp,
      kind: 'grade',
    });
  });

  projects.slice(0, 2).forEach((project) => {
    const timestamp = getValidTimestamp(project.updated_at || project.created_at);
    if (!timestamp) return;
    feed.push({
      id: `project-${project.id}`,
      title: 'Study project updated',
      detail: `${project.name} is ${project.status} for ${selectedCourse.code}`,
      timestamp,
      kind: 'project',
    });
  });

  return feed
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 8);
}

function DashboardOverview({
  selectedCourse,
  selectedCourseId,
  courses,
  dashboardStats,
  dashboardActivity,
  onSelectCourse,
}: {
  selectedCourse: (typeof COURSES)[number];
  selectedCourseId: string;
  courses: typeof COURSES;
  dashboardStats: DashboardStat[];
  dashboardActivity: DashboardActivity[];
  onSelectCourse: (courseId: string) => void;
}) {
  return (
    <section id="dashboard" className="dashboard-grid">
      <motion.article
        className="card dashboard-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Learning pulse for {selectedCourse.code}</h2>
          <p>{selectedCourse.objective}</p>
        </div>
        <div className="dashboard-hero-meta">
          <span>{selectedCourse.lecturer}</span>
          <span>{dashboardActivity.length} recent updates</span>
          <span>{selectedCourse.resources.length} core resources</span>
        </div>
      </motion.article>

      <article className="card dashboard-panel">
        <div className="card-head">
          <h3>Available subjects</h3>
          <span>{courses.length} courses</span>
        </div>
        <div className="subject-grid">
          {courses.map((course) => {
            const isActive = course.id === selectedCourseId;
            return (
              <button
                key={course.id}
                className={`subject-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelectCourse(course.id)}
              >
                <strong>{course.code}</strong>
                <span>{course.name}</span>
                <small>{course.lecturer}</small>
              </button>
            );
          })}
        </div>
      </article>

      <article className="card dashboard-panel">
        <div className="card-head">
          <h3>Recent activity</h3>
          <span>Latest course updates</span>
        </div>
        <div className="activity-feed">
          {dashboardActivity.length === 0 ? (
            <p className="dashboard-empty">No recent activity yet. Upload a file or publish course content to populate this feed.</p>
          ) : (
            dashboardActivity.map((item) => (
              <div key={item.id} className={`activity-item ${item.kind}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <small>{formatDateTime(item.timestamp)}</small>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="card dashboard-panel">
        <div className="card-head">
          <h3>At a glance</h3>
          <span>Overview metrics</span>
        </div>
        <div className="stats-grid">
          {dashboardStats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.hint}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function HeroSettingsPanel({
  featureLabelMap,
  featureMenuOrder,
  shiftMenuItem,
  customEditMode,
  onToggleCustomEditMode,
  toggleCustomLayoutFeature,
  shiftCustomLayoutFeature,
  customLayout,
  sidebarPosition,
  onChangeSidebarPosition,
}: {
  featureLabelMap: Record<FeatureMenuKey, string>;
  featureMenuOrder: FeatureMenuKey[];
  shiftMenuItem: (featureId: FeatureMenuKey, direction: 'up' | 'down') => void;
  customEditMode: boolean;
  onToggleCustomEditMode: () => void;
  toggleCustomLayoutFeature: (featureId: DashboardFeatureKey) => void;
  shiftCustomLayoutFeature: (featureId: DashboardFeatureKey, direction: 'up' | 'down') => void;
  customLayout: DashboardFeatureKey[];
  sidebarPosition: SidebarPosition;
  onChangeSidebarPosition: (position: SidebarPosition) => void;
}) {
  return (
    <div className="hero-settings-panel-content">
      <div className="sidebar-panel sidebar-settings">
        <div className="card-head">
          <h2>Menu settings</h2>
          <span>Adjust button position</span>
        </div>
        <div className="menu-settings-list">
          {featureMenuOrder.map((featureId, index) => (
            <div key={`menu-setting-${featureId}`} className="menu-settings-item">
              <span>{featureLabelMap[featureId]}</span>
              <div className="menu-settings-actions">
                <button
                  className="small ghost"
                  onClick={() => shiftMenuItem(featureId, 'up')}
                  disabled={index === 0}
                >
                  Up
                </button>
                <button
                  className="small ghost"
                  onClick={() => shiftMenuItem(featureId, 'down')}
                  disabled={index === featureMenuOrder.length - 1}
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-panel sidebar-settings">
        <div className="card-head">
          <h2>Custom page</h2>
          <span>Default main page</span>
        </div>
        <p className="status">Enable multiple functions in one page and edit their order.</p>
        <div className="controls">
          <button className="small" onClick={onToggleCustomEditMode}>
            {customEditMode ? 'Done Editing' : 'Edit Custom Layout'}
          </button>
        </div>
        {customEditMode && (
          <div className="custom-layout-editor">
            {DEFAULT_CUSTOM_LAYOUT.map((featureId) => {
              const active = customLayout.includes(featureId);
              const position = customLayout.indexOf(featureId);
              return (
                <div key={`custom-layout-${featureId}`} className="custom-layout-item">
                  <label>
                    <input type="checkbox" checked={active} onChange={() => toggleCustomLayoutFeature(featureId)} />
                    {featureLabelMap[featureId]}
                  </label>
                  <div className="menu-settings-actions">
                    <button
                      className="small ghost"
                      onClick={() => shiftCustomLayoutFeature(featureId, 'up')}
                      disabled={!active || position <= 0}
                    >
                      Up
                    </button>
                    <button
                      className="small ghost"
                      onClick={() => shiftCustomLayoutFeature(featureId, 'down')}
                      disabled={!active || position === -1 || position >= customLayout.length - 1}
                    >
                      Down
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sidebar-panel sidebar-settings">
        <div className="card-head">
          <h2>Sidebar position</h2>
        </div>
        <label className="sidebar-position-switch" htmlFor="sidebar-position-switch">
          <span className="sidebar-position-switch-copy">
            <strong>{sidebarPosition === 'right' ? 'Right side on' : 'Right side off'}</strong>
            <small>{sidebarPosition === 'right' ? 'Mirror sidebar (right side)' : 'Sidebar stays on the left'}</small>
          </span>
          <input
            id="sidebar-position-switch"
            type="checkbox"
            checked={sidebarPosition === 'right'}
            onChange={(e) => onChangeSidebarPosition(e.target.checked ? 'right' : 'left')}
          />
          <span className="sidebar-position-switch-track" aria-hidden="true">
            <span className="sidebar-position-switch-thumb" />
          </span>
        </label>
      </div>
    </div>
  );
}

export default function Home() {
  const [selectedCourseId, setSelectedCourseId] = useState(COURSES[0].id);
  const selectedCourse = useMemo(
    () => COURSES.find((course) => course.id === selectedCourseId) || COURSES[0],
    [selectedCourseId],
  );

  const [status, setStatus] = useState('Platform ready');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'updated_at'>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Course Materials, Assignments, and Grades State
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [groupCountInput, setGroupCountInput] = useState(2);
  const [minPerGroupInput, setMinPerGroupInput] = useState(1);
  const [maxPerGroupInput, setMaxPerGroupInput] = useState(3);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState(DEFAULT_TEACHER_USER_ID);
  const [groupUiNotice, setGroupUiNotice] = useState('Ready');
  const [localProjectsByCourse, setLocalProjectsByCourse] = useState<Record<string, ProjectItem[]>>({});
  const [localGroupsByProject, setLocalGroupsByProject] = useState<Record<string, GroupItem[]>>({});

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);

  const [testPromptInput, setTestPromptInput] = useState('');
  const [testStatus, setTestStatus] = useState('Waiting for instruction');
  const [testGenerating, setTestGenerating] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [testStore, setTestStore] = useState<Record<string, TestActivity[]>>({});
  const [matchingSelectedPrompt, setMatchingSelectedPrompt] = useState<string | null>(null);
  const [matchingMatchedIds, setMatchingMatchedIds] = useState<string[]>([]);
  const [matchingRightPool, setMatchingRightPool] = useState<MatchingPair[]>([]);
  const [matchingAssignments, setMatchingAssignments] = useState<Record<string, string>>({});
  const [orderingCurrent, setOrderingCurrent] = useState<string[]>([]);
  const [orderingScore, setOrderingScore] = useState<{ correct: number; total: number } | null>(null);
  const [gameMessage, setGameMessage] = useState<string>('');
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showWinBadge, setShowWinBadge] = useState(false);
  const [fillBlankSelections, setFillBlankSelections] = useState<string[]>([]);
  const [scenarioNodeId, setScenarioNodeId] = useState<number>(1);
  const [scenarioTrace, setScenarioTrace] = useState<string[]>([]);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [speedScore, setSpeedScore] = useState(0);
  const [speedStreak, setSpeedStreak] = useState(0);
  const [classifySelections, setClassifySelections] = useState<Record<string, string>>({});
  const [causeEffectOrder, setCauseEffectOrder] = useState<string[]>([]);
  const [causeEffectScore, setCauseEffectScore] = useState<{ correct: number; total: number } | null>(null);
  const [mapSelections, setMapSelections] = useState<Record<string, string>>({});
  const [activeMapLabel, setActiveMapLabel] = useState('');
  const [memoryFlipped, setMemoryFlipped] = useState<string[]>([]);
  const [memoryMatched, setMemoryMatched] = useState<string[]>([]);
  const [memoryDeck, setMemoryDeck] = useState<{ id: string; text: string }[]>([]);
  const [debateSelected, setDebateSelected] = useState<string[]>([]);
  const [teamScores, setTeamScores] = useState({ A: 0, B: 0 });
  const [teamQuestionIndex, setTeamQuestionIndex] = useState(0);
  const [quizSelections, setQuizSelections] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number } | null>(null);
  const [speedCorrectCount, setSpeedCorrectCount] = useState(0);
  const [speedComboPulse, setSpeedComboPulse] = useState(0);
  const [activityScores, setActivityScores] = useState<Record<string, number>>({});
  const [interactiveLabInput, setInteractiveLabInput] = useState('');
  const [interactiveLabGenerating, setInteractiveLabGenerating] = useState(false);
  const [interactiveLabPlan, setInteractiveLabPlan] = useState<InteractiveLabPlan | null>(null);
  const [interactiveLabRatings, setInteractiveLabRatings] = useState<Record<string, number>>({});
  const [labStatus, setLabStatus] = useState('');
  const [personalizeInput, setPersonalizeInput] = useState('');
  const [personalizedStore, setPersonalizedStore] = useState<Record<string, TestActivity[]>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [featureMenuOrder, setFeatureMenuOrder] = useState<FeatureMenuKey[]>(
    FEATURE_MENU_ITEMS.map((item) => item.id),
  );
  const [activeFeature, setActiveFeature] = useState<FeatureMenuKey>('custom');
  const [customLayout, setCustomLayout] = useState<DashboardFeatureKey[]>(DEFAULT_CUSTOM_LAYOUT);
  const [customEditMode, setCustomEditMode] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>('left');
  const [featureSearchQuery, setFeatureSearchQuery] = useState('');

  const featureLabelMap = useMemo<Record<FeatureMenuKey, string>>(
    () =>
      FEATURE_MENU_ITEMS.reduce(
        (acc, item) => {
          acc[item.id] = item.label;
          return acc;
        },
        {} as Record<FeatureMenuKey, string>,
      ),
    [],
  );

  const featureDescriptionMap = useMemo<Record<FeatureMenuKey, string>>(
    () =>
      FEATURE_MENU_ITEMS.reduce(
        (acc, item) => {
          acc[item.id] = item.description;
          return acc;
        },
        {} as Record<FeatureMenuKey, string>,
      ),
    [],
  );

  const matchedFeatureMenu = useMemo(() => {
    const keywords = featureSearchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (keywords.length === 0) return [] as FeatureMenuKey[];

    return featureMenuOrder.filter((featureId) => {
      const label = featureLabelMap[featureId]?.toLowerCase() || '';
      const description = featureDescriptionMap[featureId]?.toLowerCase() || '';
      const searchKeywords = FEATURE_SEARCH_KEYWORDS[featureId]?.join(' ').toLowerCase() || '';
      const haystack = `${label} ${description} ${featureId} ${searchKeywords}`;
      return keywords.some((keyword) => haystack.includes(keyword));
    });
  }, [featureSearchQuery, featureMenuOrder, featureLabelMap, featureDescriptionMap]);

  const isFeatureSearchActive = featureSearchQuery.trim().length > 0;
  const visibleFeatureMenu = isFeatureSearchActive ? matchedFeatureMenu : featureMenuOrder;

  const shiftMenuItem = useCallback((featureId: FeatureMenuKey, direction: 'up' | 'down') => {
    setFeatureMenuOrder((prev) => {
      const index = prev.indexOf(featureId);
      if (index === -1) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, index, target);
    });
  }, []);

  const toggleCustomLayoutFeature = useCallback((featureId: DashboardFeatureKey) => {
    setCustomLayout((prev) => {
      if (prev.includes(featureId)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== featureId);
      }
      return [...prev, featureId];
    });
  }, []);

  const shiftCustomLayoutFeature = useCallback((featureId: DashboardFeatureKey, direction: 'up' | 'down') => {
    setCustomLayout((prev) => {
      const index = prev.indexOf(featureId);
      if (index === -1) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, index, target);
    });
  }, []);

  const renderedFeatures = useMemo<DashboardFeatureKey[]>(
    () => (activeFeature === 'custom' ? customLayout : [activeFeature]),
    [activeFeature, customLayout],
  );

  const shouldRenderFeature = useCallback(
    (featureId: DashboardFeatureKey) => renderedFeatures.includes(featureId),
    [renderedFeatures],
  );

  const dashboardActivity = useMemo(
    () => buildDashboardActivityFeed(selectedCourse, files, materials, assignments, grades, projects),
    [selectedCourse, files, materials, assignments, grades, projects],
  );

  const dashboardStats = useMemo<DashboardStat[]>(
    () => [
      {
        label: 'Available subjects',
        value: String(COURSES.length),
        hint: `${selectedCourse.code} is active`,
      },
      {
        label: 'Files',
        value: String(files.length),
        hint: 'Uploaded course files',
      },
      {
        label: 'Materials',
        value: String(materials.length),
        hint: 'Lecture and reference assets',
      },
      {
        label: 'Assignments',
        value: String(assignments.length),
        hint: 'Open assessment items',
      },
      {
        label: 'Grades',
        value: String(grades.length),
        hint: 'Recorded grade entries',
      },
      {
        label: 'Projects',
        value: String(projects.length),
        hint: 'Active group projects',
      },
    ],
    [assignments.length, files.length, grades.length, materials.length, projects.length, selectedCourse.code],
  );

  const handleCourseChange = useCallback(
    (courseId: string) => {
      setSelectedCourseId(courseId);
      setActiveTestId(null);
      setTestStatus('Waiting for instruction');
      setLabStatus('');
      setChatMessages(INITIAL_CHAT_MESSAGES);
      setInteractiveLabPlan(null);
      setInteractiveLabRatings({});
    },
    [],
  );

  useEffect(() => {
    fetchList();
    fetchMaterials();
    fetchAssignments();
    fetchGrades();
    fetchProjects();
    setGroups([]);
    setSelectedProjectId('');
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchGroups(selectedProjectId);
  }, [selectedProjectId]);

  const displayNames = useMemo(() => {
    const counts: Record<string, number> = {};
    return files.map((f) => {
      const raw = basename(f.name || f.path || '');
      const base = stripTimestampPrefix(raw);
      if (!counts[base]) {
        counts[base] = 1;
        return base;
      }
      counts[base] += 1;
      return `${base}-${counts[base] - 1}`;
    });
  }, [files]);

  const sortedFiles = useMemo(() => {
    const copy = files.map((f, i) => ({ f, display: displayNames[i] }));
    if (sortKey === 'name') {
      copy.sort((a, b) => {
        const cmp = a.display.localeCompare(b.display);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else {
      copy.sort((a, b) => {
        const ta = a.f.updated_at || a.f.created_at || '';
        const tb = b.f.updated_at || b.f.created_at || '';
        const cmp = ta.localeCompare(tb);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return copy;
  }, [files, displayNames, sortKey, sortDir]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/list?courseId=${encodeURIComponent(selectedCourseId)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const list = json.files || [];
      setFiles(list);
      setStatus(list.length === 0 ? 'Upload course files to start the knowledge base.' : 'Course files loaded');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`List error: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  const fetchMaterials = useCallback(async () => {
    setMaterialsLoading(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(selectedCourseId)}/materials`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setMaterials(json.materials || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Materials fetch error:', message);
    } finally {
      setMaterialsLoading(false);
    }
  }, [selectedCourseId]);

  const fetchAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(selectedCourseId)}/assignments`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setAssignments(json.assignments || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Assignments fetch error:', message);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [selectedCourseId]);

  const fetchGrades = useCallback(async () => {
    setGradesLoading(true);
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(selectedCourseId)}/grades`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setGrades(json.grades || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Grades fetch error:', message);
    } finally {
      setGradesLoading(false);
    }
  }, [selectedCourseId]);

  const fetchProjects = useCallback(async () => {
    setProjectLoading(true);
    try {
      const res = await fetch(`/api/projects?courseId=${encodeURIComponent(selectedCourseId)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const list = (json.projects || []) as ProjectItem[];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) => prev || list[0].id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const usingLocal = localProjectsByCourse[selectedCourseId] || [];
      setProjects(usingLocal);
      setStatus(`Project list error: ${message}`);
      if (message.includes("Could not find the table 'public.projects'")) {
        setGroupUiNotice('DB project tables not found. Switched to local demo mode for group management.');
      }
    } finally {
      setProjectLoading(false);
    }
  }, [selectedCourseId, localProjectsByCourse]);

  function buildLocalGroups(projectId: string, groupCount: number, maxPerGroup: number): GroupItem[] {
    const now = new Date().toISOString();
    const mappedPresetStudents = PRESET_STUDENTS.map((id) => PRESET_STUDENT_ID_MAP[id]);
    const groups: GroupItem[] = Array.from({ length: groupCount }, (_, idx) => ({
      id: `${projectId}-group-${idx + 1}`,
      project_id: projectId,
      name: `Group ${idx + 1}`,
      capacity: maxPerGroup,
      created_at: now,
      members: [],
      memberCount: 0,
      latestChatAt: null,
    }));

    let cursor = 0;
    for (const studentId of mappedPresetStudents) {
      let attempts = 0;
      while (attempts < groups.length) {
        const group = groups[cursor % groups.length];
        cursor += 1;
        attempts += 1;
        if (group.members.length >= group.capacity) continue;
        group.members.push({ user_id: studentId, joined_at: now });
        group.memberCount = group.members.length;
        break;
      }
    }

    return groups;
  }

  async function createProject() {
    const name = projectNameInput.trim();
    if (!name) {
      setStatus('Project name is required');
      setGroupUiNotice('Project name is required');
      return;
    }
    if (minPerGroupInput > maxPerGroupInput) {
      setStatus('Min students per group cannot be greater than max students per group');
      setGroupUiNotice('Min students per group cannot be greater than max students per group');
      return;
    }

    const effectiveUserId = isUuid(currentUserId) ? currentUserId.trim() : DEFAULT_TEACHER_USER_ID;

    try {
      setGroupUiNotice('Creating project...');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          name,
          description: `Teacher config: ${groupCountInput} groups, min ${minPerGroupInput}, max ${maxPerGroupInput} per group`,
          targetGroupSize: maxPerGroupInput,
          maxGroups: groupCountInput,
          createdBy: effectiveUserId,
          status: 'grouping',
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      const json = await res.json();
      const createdProjectId = json.project?.id as string | undefined;
      if (!createdProjectId) throw new Error('Project created but missing project id');

      const mappedPresetStudents = PRESET_STUDENTS.map((id) => PRESET_STUDENT_ID_MAP[id]);
      const seedRes = await fetch(`/api/projects/${encodeURIComponent(createdProjectId)}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupCount: groupCountInput,
          maxPerGroup: maxPerGroupInput,
          presetStudentIds: mappedPresetStudents,
        }),
      });
      if (!seedRes.ok) {
        const errText = await seedRes.text();
        throw new Error(`Project created, but group creation failed: ${errText}`);
      }

      setProjectNameInput('');
      await fetchProjects();
      setSelectedProjectId(createdProjectId);
      await fetchGroups(createdProjectId);
      const okMessage =
        isUuid(currentUserId)
          ? 'Project created'
          : `Project created (teacher ID auto-corrected to ${DEFAULT_TEACHER_USER_ID})`;
      setStatus(okMessage);
      setGroupUiNotice(okMessage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Could not find the table 'public.projects'")) {
        const now = new Date().toISOString();
        const localProjectId = `local-${Date.now()}`;
        const localProject: ProjectItem = {
          id: localProjectId,
          course_id: selectedCourseId,
          name,
          description: `Teacher config: ${groupCountInput} groups, min ${minPerGroupInput}, max ${maxPerGroupInput} per group`,
          target_group_size: maxPerGroupInput,
          max_groups: groupCountInput,
          status: 'grouping',
          created_by: effectiveUserId,
          created_at: now,
          updated_at: now,
        };
        const localGroups = buildLocalGroups(localProjectId, groupCountInput, maxPerGroupInput);

        setLocalProjectsByCourse((prev) => {
          const current = prev[selectedCourseId] || [];
          return { ...prev, [selectedCourseId]: [localProject, ...current] };
        });
        setLocalGroupsByProject((prev) => ({ ...prev, [localProjectId]: localGroups }));
        setProjects((prev) => [localProject, ...prev]);
        setSelectedProjectId(localProjectId);
        setGroups(localGroups);
        setProjectNameInput('');
        setGroupUiNotice('DB tables missing. Local demo project created and displayed successfully.');
        setStatus('Local demo project created');
      } else {
        setStatus(`Create project error: ${message}`);
        setGroupUiNotice(`Create project error: ${message}`);
      }
    }
  }

  async function fetchGroups(projectId: string) {
    if (!projectId) return;
    if (projectId.startsWith('local-')) {
      const list = localGroupsByProject[projectId] || [];
      setGroups(list);
      setGroupUiNotice(list.length > 0 ? `Loaded ${list.length} groups (local mode)` : 'No groups found for this local project');
      return;
    }
    setGroupLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/groups`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const list = (json.groups || []) as GroupItem[];
      setGroups(list);
      setGroupUiNotice(list.length > 0 ? `Loaded ${list.length} groups` : 'No groups found for this project');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Group list error: ${message}`);
      if (message.includes("Could not find the table 'public.projects'")) {
        const local = localGroupsByProject[projectId] || [];
        setGroups(local);
        setGroupUiNotice(local.length > 0 ? `Loaded ${local.length} groups (local mode)` : 'DB tables missing and no local groups found');
      }
    } finally {
      setGroupLoading(false);
    }
  }

  async function uploadSingle(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('courseId', selectedCourseId);
    const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
  }

  async function uploadSelectedFiles(filesList: FileList | File[]) {
    const count = (filesList as FileList).length || 0;
    if (count === 0) {
      setStatus('No file selected');
      return;
    }

    setLoading(true);
    setStatus(`Uploading ${count} file(s) to ${selectedCourse.code}...`);
    try {
      for (let i = 0; i < count; i++) {
        const file = (filesList as FileList)[i] as File;
        setStatus(`Uploading ${i + 1}/${count}: ${file.name}`);
        await uploadSingle(file);
      }
      await fetchList();
      setStatus(`Uploaded ${count} file(s) to ${selectedCourse.code}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFileName(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Upload error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(path: string) {
    if (!confirm(`Delete "${basename(path)}"?`)) return;
    setStatus(`Deleting ${basename(path)}...`);
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, courseId: selectedCourseId }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchList();
      setStatus(`Deleted ${basename(path)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Delete error: ${message}`);
    }
  }

  async function handleRename(oldPath: string) {
    const newBase = prompt('New file name (include extension)', stripTimestampPrefix(basename(oldPath)));
    if (!newBase) return;
    const prefix = oldPath.includes('/') ? `${oldPath.split('/').slice(0, -1).join('/')}/` : '';
    const newPath = `${prefix}${newBase}`;

    setStatus(`Renaming ${basename(oldPath)} -> ${newBase}`);
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath, courseId: selectedCourseId }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchList();
      setStatus(`Renamed to ${newBase}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Rename error: ${message}`);
    }
  }

  function toggleSortOnName() {
    if (sortKey === 'name') {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey('name');
    setSortDir('asc');
  }

  function toggleSortOnUpdated() {
    if (sortKey === 'updated_at') {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey('updated_at');
    setSortDir('desc');
  }

  function openPreview(file: FileItem, displayName: string) {
    if (!file.url) {
      setStatus('No preview URL available');
      return;
    }
    setPreviewUrl(file.url);
    setPreviewName(displayName);
  }

  async function generateSummary(file: FileItem, displayName: string) {
    setSummaryLoading(true);
    setStatus(`Generating summary for ${displayName}...`);
    try {
      const res = await fetch('/api/files/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path, courseId: selectedCourseId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setSummaryText(j.summary || 'No summary available');
      setSummaryOpen(true);
      setStatus('Summary generated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Summary error: ${message}`);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function sendMessage() {
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    const nextMessages = [...chatMessages, { role: 'user' as const, content: message, createdAt: new Date().toISOString() }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/virtual-teacher/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          message,
          history: nextMessages,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response || 'No response', createdAt: new Date().toISOString() },
      ]);
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : String(err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I cannot reach the AI service right now. Here is a fallback suggestion: Review the latest lecture summary and assignment criteria for ${selectedCourse.code}. Error: ${messageText}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function buildActivityName(subject: string, promptText: string) {
    const cleanPrompt = promptText.trim();
    const shortPrompt = cleanPrompt.length > 42 ? `${cleanPrompt.slice(0, 39)}...` : cleanPrompt;
    return `${subject} Test - ${shortPrompt}`;
  }

  function buildStudentReactionHistory() {
    const history: { title: string; activityType: ActivityType; score: number }[] = [];

    currentCourseActivities.forEach((activity) => {
      const score = activityScores[activity.id];
      if (typeof score === 'number') {
        history.push({
          title: activity.title,
          activityType: activity.activityType,
          score,
        });
      }
    });

    return history.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  function applyQuizFallbackPrompt(prompt: string) {
    setTestPromptInput(prompt);
    setTestStatus('Quiz prompt prepared. Use Generate Test to continue.');
  }

  function shuffleArray<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function detectActivityType(promptText: string): ActivityType {
    const lower = promptText.toLowerCase();
    if (/(match|pair|flashcard|connect)/.test(lower)) return 'matching';
    if (/(order|sequence|timeline|arrange|sort)/.test(lower)) return 'ordering';
    if (/(fill|blank|cloze)/.test(lower)) return 'fill-blank';
    if (/(scenario|branch|decision|story)/.test(lower)) return 'scenario';
    if (/(speed|lightning|rapid|quick)/.test(lower)) return 'speed-challenge';
    if (/(classification|classify|category|categorize|group)/.test(lower)) return 'classification';
    if (/(cause|effect|chain|logic)/.test(lower)) return 'cause-effect';
    if (/(memory|flip|card)/.test(lower)) return 'memory';
    if (/(debate|argument|claim|evidence)/.test(lower)) return 'debate';
    if (/(team|battle|competition|versus|vs)/.test(lower)) return 'team-battle';
    return 'quiz';
  }

  function parseRequestedCount(promptText: string, fallback: number, min: number) {
    const wordCounts: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };

    const patterns = [
      /(\d+)\s*(?:multiple[-\s]?choice\s*)?(?:questions?|qs?|items?|pairs?|cards?|blanks?|blank|nodes?|steps?|options?|rounds?)/i,
      /(?:questions?|qs?|items?|pairs?|cards?|blanks?|blank|nodes?|steps?|options?|rounds?)\s*(?:of|with|for)?\s*(\d+)/i,
      /(\d+)\s*(?:題|题|項|项|對|对|張|张|個|个)/i,
    ];

    for (const pattern of patterns) {
      const match = promptText.match(pattern);
      if (!match) continue;

      const count = Number.parseInt(match[1], 10);
      if (Number.isFinite(count) && count > 0) {
        return Math.max(min, count);
      }
    }

    const wordPattern = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b|([一二三四五六七八九十])(?=\s*(?:questions?|qs?|items?|pairs?|cards?|blanks?|blank|nodes?|steps?|options?|rounds?|題|题|項|项|對|对|張|张|個|个))/i;
    const wordMatch = promptText.match(wordPattern);
    const word = (wordMatch?.[1] || wordMatch?.[2] || '').toLowerCase();
    if (word) {
      const count = wordCounts[word];
      if (count) {
        return Math.max(min, count);
      }
    }

    return Math.max(min, fallback);
  }

  function parseRequestedQuestionCount(promptText: string, fallback = 3) {
    return parseRequestedCount(promptText, fallback, 1);
  }

  function createMockQuestions(subject: string, promptText: string, count = 3): TestQuestion[] {
    const subjectLabel = subject.toLowerCase();
    const promptSummary = promptText.trim();
    const templates: TestQuestion[] = [
      {
        question: `What is the best answer to this ${subjectLabel} concept question based on the instruction?`,
        options: [
          'Option A: Basic understanding',
          'Option B: Applied reasoning',
          'Option C: Incorrect interpretation',
          'Option D: Extended challenge',
        ],
      },
      {
        question: `Which statement most accurately matches the activity goal: "${promptSummary}"?`,
        options: [
          'Option A: Knowledge recall',
          'Option B: Skill practice',
          'Option C: Classroom discussion',
          'Option D: Assessment summary',
        ],
      },
      {
        question: 'Choose the most suitable approach a student should take to solve this task.',
        options: [
          'Option A: Guessing quickly',
          'Option B: Reviewing key concepts',
          'Option C: Skipping reasoning steps',
          'Option D: Ignoring instructions',
        ],
      },
      {
        question: `Which choice best reflects a strong ${subjectLabel} answer aligned with the instruction?`,
        options: [
          'Option A: A complete, evidence-based response',
          'Option B: A short but unrelated response',
          'Option C: A response with no explanation',
          'Option D: A response copied from memory without checking',
        ],
      },
      {
        question: `What should the learner do first when solving the ${subjectLabel} task described in the prompt?`,
        options: [
          'Option A: Identify the key concept or requirement',
          'Option B: Skip straight to the final answer',
          'Option C: Ignore the instruction wording',
          'Option D: Randomly select an option',
        ],
      },
    ];

    return Array.from({ length: count }, (_, index) => ({
      ...templates[index % templates.length],
      question: `${templates[index % templates.length].question}${index >= templates.length ? ` (${index + 1})` : ''}`,
    }));
  }

  function createMockMatchingPairs(subject: string, count = 4): MatchingPair[] {
    const templates = subject.toLowerCase().includes('computer')
      ? [
          { prompt: 'Variable', answer: 'Named storage for a value' },
          { prompt: 'Loop', answer: 'Repeats a block of code' },
          { prompt: 'Array', answer: 'Ordered list of values' },
          { prompt: 'Function', answer: 'Reusable block of logic' },
          { prompt: 'Class', answer: 'Blueprint for objects' },
          { prompt: 'Algorithm', answer: 'Step-by-step problem solving method' },
        ]
      : [
          { prompt: 'Key Concept', answer: `${subject} foundation principle` },
          { prompt: 'Core Skill', answer: `Applied ${subject.toLowerCase()} problem solving` },
          { prompt: 'Assessment Focus', answer: 'Reasoning with evidence' },
          { prompt: 'Common Mistake', answer: 'Skipping step-by-step analysis' },
          { prompt: 'Best Practice', answer: 'Connect ideas to examples' },
          { prompt: 'Review Tip', answer: 'Summarize the main idea first' },
        ];

    return Array.from({ length: count }, (_, index) => {
      const template = templates[index % templates.length];
      const suffix = index >= templates.length ? ` ${Math.floor(index / templates.length) + 1}` : '';
      return {
        id: `p${index + 1}`,
        prompt: `${template.prompt}${suffix}`,
        answer: template.answer,
      };
    });
  }

  function createMockOrderingItems(subject: string, count = 5): string[] {
    const templates = subject.toLowerCase().includes('computer')
      ? ['Understand requirements', 'Design algorithm', 'Write code', 'Test edge cases', 'Refactor', 'Present solution']
      : ['Review instruction', `Identify ${subject.toLowerCase()} concepts`, 'Draft approach', 'Solve with steps', 'Check answer', 'Reflect on feedback'];

    return Array.from({ length: count }, (_, index) => {
      const label = templates[index % templates.length];
      return index >= templates.length ? `${label} ${Math.floor(index / templates.length) + 1}` : label;
    });
  }

  function createFillBlankMock(subject: string, count = 2) {
    const blankCount = Math.max(1, count);
    const subjectLabel = subject.toLowerCase();
    const answers = Array.from({ length: blankCount }, (_, index) => {
      if (subjectLabel.includes('computer')) {
        return ['input', 'output', 'algorithm', 'logic', 'requirements', 'edge cases'][index % 6];
      }
      return ['key idea', 'evidence', 'analysis', 'conclusion', 'supporting detail', 'example'][index % 6];
    });

    const sentence = subjectLabel.includes('computer')
      ? Array.from({ length: blankCount }, (_, index) => `___${index + 1}`).join(', ')
      : Array.from({ length: blankCount }, (_, index) => `___${index + 1}`).join(', ');

    const optionBank = subjectLabel.includes('computer')
      ? ['input', 'output', 'algorithm', 'logic', 'requirements', 'edge cases', 'guessing', 'copying', 'loop', 'error']
      : ['key idea', 'evidence', 'analysis', 'conclusion', 'supporting detail', 'example', 'guessing', 'irrelevant detail', 'copied text', 'random answer'];

    return {
      sentence: subjectLabel.includes('computer')
        ? `A program uses ${sentence} to produce a solution.`
        : `A strong ${subjectLabel} response includes ${sentence}.`,
      answers,
      options: optionBank,
    };
  }

  function createScenarioNodes(subject: string, count = 4): ScenarioNode[] {
    const scenarioCount = Math.max(2, count);
    const prompts = [
      `A student is stuck on a ${subject.toLowerCase()} task. What should happen first?`,
      'Good start. Which support strategy is best next?',
      'Learning quality dropped. Choose a corrective action.',
      'The student is improving. What should the next step be?',
      'The student is ready for a harder challenge. What now?',
      'Success path reached. Student can now complete an independent challenge.',
    ];

    return Array.from({ length: scenarioCount }, (_, index) => ({
      id: index + 1,
      prompt: prompts[index % prompts.length],
      choices:
        index === scenarioCount - 1
          ? []
          : [
              { label: index === 0 ? 'Review key concept notes' : 'Move forward with guidance', next: Math.min(scenarioCount, index + 2) },
              { label: index === scenarioCount - 2 ? 'Attempt the independent challenge' : 'Skip directly to final answer', next: Math.max(1, index) },
            ],
    }));
  }

  function createClassificationMock(subject: string, count = 4) {
    const categories = ['Concept', 'Application'];
    const templates = subject.toLowerCase().includes('computer')
      ? ['Array', 'If statement', 'Object', 'Loop', 'Variable', 'Function']
      : [`${subject} definition`, `${subject} case study`, 'Core terminology', 'Problem-solving steps', 'Worked example', 'Reflection note'];

    return {
      categories: subject.toLowerCase().includes('computer') ? ['Data', 'Control'] : categories,
      items: Array.from({ length: count }, (_, index) => ({
        id: `c${index + 1}`,
        label: `${templates[index % templates.length]}${index >= templates.length ? ` ${Math.floor(index / templates.length) + 1}` : ''}`,
        category: index % 2 === 0 ? (subject.toLowerCase().includes('computer') ? 'Data' : 'Concept') : subject.toLowerCase().includes('computer') ? 'Control' : 'Application',
      })),
    };
  }

  function createCauseEffectPairs(subject: string, count = 3) {
    const templates = [
      { cause: `Strong foundation in ${subject.toLowerCase()} concepts`, effect: 'Higher confidence in solving tasks' },
      { cause: 'Regular formative feedback', effect: 'Faster learning adjustments' },
      { cause: 'Collaborative practice sessions', effect: 'Better problem-solving quality' },
      { cause: 'Clear worked examples', effect: 'Improved transfer to new problems' },
      { cause: 'Short review cycles', effect: 'Stronger long-term retention' },
      { cause: 'Targeted practice', effect: 'More accurate answers under pressure' },
    ];

    return Array.from({ length: count }, (_, index) => {
      const template = templates[index % templates.length];
      const suffix = index >= templates.length ? ` ${Math.floor(index / templates.length) + 1}` : '';
      return {
        cause: `${template.cause}${suffix}`,
        effect: template.effect,
      };
    });
  }

  function createMapPoints(subject: string, count = 3) {
    const templates = [
      `${subject} Concept Hub`,
      'Practice Zone',
      'Assessment Checkpoint',
      'Feedback Station',
      'Revision Corner',
      'Challenge Path',
    ];

    return Array.from({ length: count }, (_, index) => ({
      id: `p${index + 1}`,
      location: `Point ${String.fromCharCode(65 + index)}`,
      label: `${templates[index % templates.length]}${index >= templates.length ? ` ${Math.floor(index / templates.length) + 1}` : ''}`,
    }));
  }

  function createDebateMock(subject: string, count = 4) {
    const templates = [
      { text: 'Student engagement rises in applied tasks.', supports: true },
      { text: 'No planning is required for projects.', supports: false },
      { text: 'Concept retention improves with active practice.', supports: true },
      { text: 'Assessment quality always decreases.', supports: false },
      { text: 'Feedback helps students refine their reasoning.', supports: true },
      { text: 'All evidence should be ignored in debate prep.', supports: false },
    ];

    return {
      claim: `Schools should increase project-based ${subject.toLowerCase()} learning time.`,
      evidence: Array.from({ length: count }, (_, index) => ({
        id: `d${index + 1}`,
        text: templates[index % templates.length].text,
        supports: templates[index % templates.length].supports,
      })),
    };
  }

  async function generateTestActivityFromAI(subject: string, promptText: string) {
    // AI_API_PLACEHOLDER_TOKEN
    // Insert your AI API integration here and return:
    // { title, instructionSummary, activityType, questions?, matchingPairs?, orderingItems? }.
    return new Promise<Omit<TestActivity, 'id'>>((resolve) => {
      setTimeout(() => {
        const activityType = detectActivityType(promptText);
        const requestedQuestions = parseRequestedCount(promptText, 5, 1);
        const requestedItems = parseRequestedCount(promptText, 4, 2);
        const requestedSequence = parseRequestedCount(promptText, 5, 2);
        const requestedBlanks = parseRequestedCount(promptText, 2, 2);
        const requestedScenarioNodes = parseRequestedCount(promptText, 4, 3);
        const requestedEvidence = parseRequestedCount(promptText, 4, 2);

        if (activityType === 'matching') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 180,
            matchingPairs: createMockMatchingPairs(subject, requestedItems),
          });
          return;
        }

        if (activityType === 'ordering') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 150,
            orderingItems: createMockOrderingItems(subject, requestedSequence),
          });
          return;
        }

        if (activityType === 'fill-blank') {
          const fill = createFillBlankMock(subject, requestedBlanks);
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 120,
            blankSentence: fill.sentence,
            blankAnswers: fill.answers,
            blankOptions: shuffleArray(fill.options),
          });
          return;
        }

        if (activityType === 'scenario') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 180,
            scenarioNodes: createScenarioNodes(subject, requestedScenarioNodes),
          });
          return;
        }

        if (activityType === 'speed-challenge') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 90,
            speedQuestions: createMockQuestions(subject, promptText, requestedQuestions),
          });
          return;
        }

        if (activityType === 'classification') {
          const classification = createClassificationMock(subject, requestedItems);
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 180,
            categories: classification.categories,
            classificationItems: classification.items,
          });
          return;
        }

        if (activityType === 'cause-effect') {
          const pairs = createCauseEffectPairs(subject, requestedEvidence);
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 150,
            causeEffectPairs: pairs,
          });
          return;
        }

        if (activityType === 'memory') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 180,
            memoryPairs: createMockMatchingPairs(subject, requestedItems),
          });
          return;
        }

        if (activityType === 'debate') {
          const debate = createDebateMock(subject, requestedEvidence);
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 180,
            debateClaim: debate.claim,
            debateEvidence: debate.evidence,
          });
          return;
        }

        if (activityType === 'team-battle') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 120,
            teamBattleQuestions: createMockQuestions(subject, promptText, requestedQuestions),
          });
          return;
        }

        resolve({
          title: buildActivityName(subject, promptText),
          instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
          activityType,
          timeLimitSec: 0,
          questions: createMockQuestions(subject, promptText, requestedQuestions),
        });
      }, 600);
    });
  }

  async function handleGenerateTestActivity() {
    const instruction = testPromptInput.trim();
    if (!instruction || testGenerating) {
      if (!instruction) setTestStatus('Please enter an instruction');
      return;
    }

    setTestGenerating(true);
    setTestStatus('Generating...');

    try {
      const subjectLabel = selectedCourse.name;
      const generated = await generateTestActivityFromAI(subjectLabel, instruction);
      const newActivity: TestActivity = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...generated,
      };

      setTestStore((prev) => ({
        ...prev,
        [selectedCourseId]: [newActivity, ...(prev[selectedCourseId] || [])],
      }));
      setActiveTestId(newActivity.id);
      setTestPromptInput('');
      setTestStatus('New test generated');
    } catch {
      setTestStatus('Generation failed');
    } finally {
      setTestGenerating(false);
    }
  }

  async function handleGenerateInteractiveLab() {
    const instruction = interactiveLabInput.trim();
    if (!instruction || interactiveLabGenerating) {
      if (!instruction) setLabStatus('Please enter an interactive lab instruction');
      return;
    }

    setInteractiveLabGenerating(true);
    setLabStatus('Generating interactive lab...');

    try {
      const recentHistory = buildStudentReactionHistory();
      const res = await fetch(`/api/courses/${encodeURIComponent(selectedCourseId)}/interactive-labs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          history: recentHistory,
          averageScore: averageCourseScore,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as InteractiveLabPlan & { source?: string };
      setInteractiveLabPlan(data);
      setInteractiveLabRatings({});
      setInteractiveLabInput('');

      if (data.mode === 'quiz') {
        setLabStatus('No suitable interactive game. Use Generate Test for the quiz version.');
      } else {
        setLabStatus('Interactive lab generated');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setLabStatus(`Interactive lab generation failed: ${message}`);
    } finally {
      setInteractiveLabGenerating(false);
    }
  }

  const currentCourseActivities = testStore[selectedCourseId] || [];
  const currentPersonalizedActivities = personalizedStore[selectedCourseId] || [];
  const currentActivityEntries = currentCourseActivities.flatMap((activity) => [
    { activity, variant: 'original' as const },
    ...currentPersonalizedActivities
      .filter((item) => item.parentActivityId === activity.id)
      .map((item) => ({ activity: item, variant: 'personalized' as const })),
  ]);
  const activeTestActivity =
    currentActivityEntries.find((entry) => entry.activity.id === activeTestId)?.activity ||
    currentActivityEntries[0]?.activity ||
    null;
  const scoredCourseActivities = currentCourseActivities
    .map((activity) => ({ activity, score: activityScores[activity.id] }))
    .filter((entry): entry is { activity: TestActivity; score: number } => typeof entry.score === 'number');
  const averageCourseScore =
    scoredCourseActivities.length > 0
      ? Math.round(scoredCourseActivities.reduce((sum, entry) => sum + entry.score, 0) / scoredCourseActivities.length)
      : null;

  function recordActivityScore(activityId: string, score: number) {
    setActivityScores((prev) => ({
      ...prev,
      [activityId]: Math.round(Math.max(0, Math.min(100, score))),
    }));
  }

  async function handlePersonalizeActivity() {
    if (!activeTestActivity) return;
    const note = personalizeInput.trim();
    if (!note) {
      setTestStatus('Please enter personalization content');
      return;
    }

    const rootParentId = activeTestActivity.parentActivityId || activeTestActivity.id;
    const nextVersion =
      currentPersonalizedActivities.filter((item) => item.parentActivityId === rootParentId).length + 1;
    const baseTitle = getBaseActivityTitle(activeTestActivity.title);

    const personalizedActivity: TestActivity = {
      ...activeTestActivity,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${baseTitle} Personalization ${nextVersion}`,
      instructionSummary: `Personalization ${nextVersion} -- ${note}`,
      parentActivityId: rootParentId,
      personalizationNote: note,
    };

    setPersonalizedStore((prev) => ({
      ...prev,
      [selectedCourseId]: [personalizedActivity, ...(prev[selectedCourseId] || [])],
    }));
    setActiveTestId(personalizedActivity.id);
    setPersonalizeInput('');
    setTestStatus('Personalized activity created');
  }

  const labAverageRating =
    interactiveLabPlan?.lab && Object.keys(interactiveLabRatings).length > 0
      ? Math.round(
          Object.values(interactiveLabRatings).reduce((sum, value) => sum + value, 0) /
            Object.values(interactiveLabRatings).length,
        )
      : null;

  useEffect(() => {
    setMatchingSelectedPrompt(null);
    setMatchingMatchedIds([]);
    setMatchingAssignments({});
    setOrderingScore(null);
    setGameMessage('');
    setShowWinBadge(false);
    setFillBlankSelections([]);
    setScenarioNodeId(1);
    setScenarioTrace([]);
    setSpeedIndex(0);
    setSpeedScore(0);
    setSpeedStreak(0);
    setClassifySelections({});
    setCauseEffectScore(null);
    setMapSelections({});
    setActiveMapLabel('');
    setMemoryFlipped([]);
    setMemoryMatched([]);
    setMemoryDeck([]);
    setDebateSelected([]);
    setTeamScores({ A: 0, B: 0 });
    setTeamQuestionIndex(0);
    setQuizSelections({});
    setQuizScore(null);

    if (!activeTestActivity) {
      setMatchingRightPool([]);
      setOrderingCurrent([]);
      setCauseEffectOrder([]);
      setTimeLeftSec(null);
      setTimerRunning(false);
      return;
    }

    const initialTime = activeTestActivity.timeLimitSec || 0;
    if (activeTestActivity.activityType !== 'quiz' && initialTime > 0) {
      setTimeLeftSec(initialTime);
      setTimerRunning(true);
    } else {
      setTimeLeftSec(null);
      setTimerRunning(false);
    }

    if (activeTestActivity.activityType === 'matching') {
      const pairs = activeTestActivity.matchingPairs || [];
      setMatchingRightPool(shuffleArray(pairs));
      return;
    }

    if (activeTestActivity.activityType === 'ordering') {
      const items = activeTestActivity.orderingItems || [];
      setOrderingCurrent(shuffleArray(items));
      return;
    }

    if (activeTestActivity.activityType === 'cause-effect') {
      const pairs = activeTestActivity.causeEffectPairs || [];
      const effects = shuffleArray(pairs.map((p) => p.effect));
      setCauseEffectOrder(effects);
      return;
    }

    if (activeTestActivity.activityType === 'fill-blank') {
      const answerCount = (activeTestActivity.blankAnswers || []).length;
      setFillBlankSelections(Array.from({ length: answerCount }, () => ''));
      return;
    }

    if (activeTestActivity.activityType === 'scenario') {
      setScenarioNodeId(1);
      setScenarioTrace([]);
      return;
    }

    if (activeTestActivity.activityType === 'memory') {
      const deck = shuffleArray(
        (activeTestActivity.memoryPairs || []).flatMap((pair) => [
          { id: `${pair.id}:prompt`, text: pair.prompt },
          { id: `${pair.id}:answer`, text: pair.answer },
        ]),
      );
      setMemoryDeck(deck);
      setMemoryFlipped([]);
      setMemoryMatched([]);
    }
  }, [activeTestActivity?.id]);

  useEffect(() => {
    if (!timerRunning || timeLeftSec === null) return;
    if (timeLeftSec <= 0) {
      setTimerRunning(false);
      setGameMessage('Time is up. Press reset to try again.');
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timerRunning, timeLeftSec]);

  useEffect(() => {
    if (!showWinBadge) return;
    const t = window.setTimeout(() => setShowWinBadge(false), 1800);
    return () => window.clearTimeout(t);
  }, [showWinBadge]);

  function handleMatchingAnswer(answerId: string) {
    if (!activeTestActivity || activeTestActivity.activityType !== 'matching') return;
    if (timeLeftSec === 0) {
      setGameMessage('Time is up. Press reset to play again.');
      return;
    }
    if (!matchingSelectedPrompt) {
      setGameMessage('Select a prompt on the left first.');
      return;
    }

    if (matchingMatchedIds.includes(answerId)) return;

    if (matchingSelectedPrompt === answerId) {
      const nextMatched = [...matchingMatchedIds, answerId];
      setMatchingMatchedIds(nextMatched);
      setMatchingSelectedPrompt(null);
      const total = (activeTestActivity.matchingPairs || []).length;
      if (nextMatched.length === total) {
        setTimerRunning(false);
        setShowWinBadge(true);
        recordActivityScore(activeTestActivity.id, 100);
        setGameMessage('Great job! All pairs matched.');
      } else {
        setGameMessage('Correct match!');
      }
      return;
    }

    setGameMessage('Not a match. Try another answer.');
  }

  function handleMatchingDragEnd(event: DragEndEvent) {
    if (!activeTestActivity || activeTestActivity.activityType !== 'matching') return;
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (!draggedId.startsWith('answer-') || !overId.startsWith('prompt-')) return;

    const answerId = draggedId.replace('answer-', '');
    const promptId = overId.replace('prompt-', '');
    const pairs = activeTestActivity.matchingPairs || [];
    const nextAssignments = { ...matchingAssignments, [promptId]: answerId };
    setMatchingAssignments(nextAssignments);

    const matchedIds = pairs.filter((pair) => nextAssignments[pair.id] === pair.id).map((pair) => pair.id);
    setMatchingMatchedIds(matchedIds);
    recordActivityScore(activeTestActivity.id, pairs.length > 0 ? (matchedIds.length / pairs.length) * 100 : 0);

    if (matchedIds.length === pairs.length && pairs.length > 0) {
      setTimerRunning(false);
      setShowWinBadge(true);
      setGameMessage('Great job! All pairs matched.');
      return;
    }
    setGameMessage('Answer dropped. Continue matching.');
  }

  function handleOrderingDragEnd(event: DragEndEvent) {
    if (!activeTestActivity || activeTestActivity.activityType !== 'ordering') return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderingCurrent.indexOf(String(active.id));
    const newIndex = orderingCurrent.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrderingCurrent((prev) => arrayMove(prev, oldIndex, newIndex));
    setOrderingScore(null);
    setGameMessage('Timeline order updated.');
  }

  function handleMapHotspotClick(pointId: string) {
    if (!activeMapLabel) {
      setGameMessage('Pick a label chip first, then click a hotspot.');
      return;
    }
    setMapSelections((prev) => ({ ...prev, [pointId]: activeMapLabel }));
  }

  function moveOrderingItem(index: number, direction: 'up' | 'down') {
    if (!activeTestActivity || activeTestActivity.activityType !== 'ordering') return;
    if (timeLeftSec === 0) {
      setGameMessage('Time is up. Press reset to play again.');
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderingCurrent.length) return;

    const next = [...orderingCurrent];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setOrderingCurrent(next);
    setOrderingScore(null);
    setGameMessage('Order updated.');
  }

  function checkOrderingAnswer() {
    if (!activeTestActivity || activeTestActivity.activityType !== 'ordering') return;
    if (timeLeftSec === 0) {
      setGameMessage('Time is up. Press reset to play again.');
      return;
    }
    const expected = activeTestActivity.orderingItems || [];
    let correct = 0;
    orderingCurrent.forEach((item, index) => {
      if (item === expected[index]) correct += 1;
    });
    setOrderingScore({ correct, total: expected.length });
    recordActivityScore(activeTestActivity.id, expected.length > 0 ? (correct / expected.length) * 100 : 0);
    if (correct === expected.length) {
      setTimerRunning(false);
      setShowWinBadge(true);
      setGameMessage('Perfect sequence!');
    } else {
      setGameMessage('Keep refining the sequence.');
    }
  }

  function resetCurrentGame() {
    if (!activeTestActivity) return;

    if (activeTestActivity.activityType === 'quiz') {
      setQuizSelections({});
      setQuizScore(null);
      setGameMessage('Quiz reset.');
      return;
    }

    if (activeTestActivity.activityType === 'matching') {
      const pairs = activeTestActivity.matchingPairs || [];
      setMatchingSelectedPrompt(null);
      setMatchingMatchedIds([]);
      setMatchingRightPool(shuffleArray(pairs));
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Matching game reset.');
      return;
    }

    if (activeTestActivity.activityType === 'ordering') {
      const items = activeTestActivity.orderingItems || [];
      setOrderingCurrent(shuffleArray(items));
      setOrderingScore(null);
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Ordering game reset.');
      return;
    }

    if (activeTestActivity.activityType === 'fill-blank') {
      const answerCount = (activeTestActivity.blankAnswers || []).length;
      setFillBlankSelections(Array.from({ length: answerCount }, () => ''));
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Fill-in-the-blank activity reset.');
      return;
    }

    if (activeTestActivity.activityType === 'scenario') {
      setScenarioNodeId(1);
      setScenarioTrace([]);
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Scenario activity reset.');
      return;
    }

    if (activeTestActivity.activityType === 'speed-challenge') {
      setSpeedIndex(0);
      setSpeedScore(0);
      setSpeedStreak(0);
      setSpeedComboPulse(0);
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Speed challenge reset.');
      return;
    }

    if (activeTestActivity.activityType === 'classification') {
      setClassifySelections({});
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Classification game reset.');
      return;
    }

    if (activeTestActivity.activityType === 'cause-effect') {
      const effects = shuffleArray((activeTestActivity.causeEffectPairs || []).map((p) => p.effect));
      setCauseEffectOrder(effects);
      setCauseEffectScore(null);
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Cause-effect game reset.');
      return;
    }

    if (activeTestActivity.activityType === 'map-label') {
      setMapSelections({});
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Map labeling game reset.');
      return;
    }

    if (activeTestActivity.activityType === 'memory') {
      const deck = shuffleArray(
        (activeTestActivity.memoryPairs || []).flatMap((pair) => [
          { id: `${pair.id}:prompt`, text: pair.prompt },
          { id: `${pair.id}:answer`, text: pair.answer },
        ]),
      );
      setMemoryDeck(deck);
      setMemoryFlipped([]);
      setMemoryMatched([]);
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Memory game reset.');
      return;
    }

    if (activeTestActivity.activityType === 'debate') {
      setDebateSelected([]);
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Debate prep game reset.');
      return;
    }

    if (activeTestActivity.activityType === 'team-battle') {
      setTeamScores({ A: 0, B: 0 });
      setTeamQuestionIndex(0);
      setTimeLeftSec(activeTestActivity.timeLimitSec || 0);
      setTimerRunning((activeTestActivity.timeLimitSec || 0) > 0);
      setGameMessage('Team battle reset.');
    }
  }

  function checkFillBlankAnswers() {
    if (!activeTestActivity || activeTestActivity.activityType !== 'fill-blank') return;
    const answers = activeTestActivity.blankAnswers || [];
    const correct = answers.filter((ans, idx) => fillBlankSelections[idx] === ans).length;
    if (correct === answers.length) {
      setShowWinBadge(true);
      setTimerRunning(false);
      recordActivityScore(activeTestActivity.id, answers.length > 0 ? 100 : 0);
      setGameMessage('Excellent! All blanks are correct.');
    } else {
      recordActivityScore(activeTestActivity.id, answers.length > 0 ? (correct / answers.length) * 100 : 0);
      setGameMessage(`You have ${correct}/${answers.length} correct blanks.`);
    }
  }

  function handleScenarioChoice(choice: ScenarioChoice) {
    if (!activeTestActivity || activeTestActivity.activityType !== 'scenario') return;
    const currentNode = (activeTestActivity.scenarioNodes || []).find((node) => node.id === scenarioNodeId);
    if (currentNode) {
      setScenarioTrace((prev) => [...prev, choice.label]);
    }
    setScenarioNodeId(choice.next);
    const nextNode = (activeTestActivity.scenarioNodes || []).find((node) => node.id === choice.next);
    if (nextNode && nextNode.choices.length === 0) {
      setShowWinBadge(true);
      setTimerRunning(false);
      recordActivityScore(activeTestActivity.id, 100);
      setGameMessage('Scenario completed with a teaching-friendly path.');
    }
  }

  function answerSpeedChallenge(isCorrect: boolean) {
    if (!activeTestActivity || activeTestActivity.activityType !== 'speed-challenge') return;
    const total = (activeTestActivity.speedQuestions || []).length;
    const nextIndex = speedIndex + 1;
    const nextCorrectCount = speedCorrectCount + (isCorrect ? 1 : 0);
    if (isCorrect) {
      const nextStreak = speedStreak + 1;
      setSpeedCorrectCount(nextCorrectCount);
      setSpeedStreak(nextStreak);
      setSpeedComboPulse((v) => v + 1);
      setSpeedScore((prev) => prev + 10 + nextStreak * 2);
      setGameMessage('Correct! Keep your streak alive.');
    } else {
      setSpeedCorrectCount(nextCorrectCount);
      setSpeedStreak(0);
      setGameMessage('Incorrect. Try the next one quickly.');
    }
    setSpeedIndex(nextIndex);
    if (nextIndex >= total) {
      recordActivityScore(activeTestActivity.id, total > 0 ? (nextCorrectCount / total) * 100 : 0);
      setShowWinBadge(true);
      setTimerRunning(false);
      setGameMessage('Speed challenge completed!');
    }
  }

  function checkClassification() {
    if (!activeTestActivity || activeTestActivity.activityType !== 'classification') return;
    const items = activeTestActivity.classificationItems || [];
    const correct = items.filter((it) => classifySelections[it.id] === it.category).length;
    recordActivityScore(activeTestActivity.id, items.length > 0 ? (correct / items.length) * 100 : 0);
    if (correct === items.length && items.length > 0) {
      setShowWinBadge(true);
      setTimerRunning(false);
      setGameMessage('All items are classified correctly.');
    } else {
      setGameMessage(`Classification score: ${correct}/${items.length}`);
    }
  }

  function moveCauseEffect(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= causeEffectOrder.length) return;
    const next = [...causeEffectOrder];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setCauseEffectOrder(next);
    setCauseEffectScore(null);
  }

  function checkCauseEffect() {
    if (!activeTestActivity || activeTestActivity.activityType !== 'cause-effect') return;
    const expected = (activeTestActivity.causeEffectPairs || []).map((p) => p.effect);
    const correct = causeEffectOrder.filter((value, idx) => value === expected[idx]).length;
    setCauseEffectScore({ correct, total: expected.length });
    recordActivityScore(activeTestActivity.id, expected.length > 0 ? (correct / expected.length) * 100 : 0);
    if (correct === expected.length) {
      setShowWinBadge(true);
      setTimerRunning(false);
      setGameMessage('Cause-effect chain is perfectly aligned.');
    } else {
      setGameMessage(`Chain accuracy: ${correct}/${expected.length}`);
    }
  }

  function checkMapLabels() {
    if (!activeTestActivity || activeTestActivity.activityType !== 'map-label') return;
    const points = activeTestActivity.mapPoints || [];
    const correct = points.filter((point) => mapSelections[point.id] === point.label).length;
    recordActivityScore(activeTestActivity.id, points.length > 0 ? (correct / points.length) * 100 : 0);
    if (correct === points.length && points.length > 0) {
      setShowWinBadge(true);
      setTimerRunning(false);
      setGameMessage('All map points are labeled correctly.');
    } else {
      setGameMessage(`Map labeling score: ${correct}/${points.length}`);
    }
  }

  function flipMemoryCard(cardId: string) {
    if (!activeTestActivity || activeTestActivity.activityType !== 'memory') return;
    if (memoryMatched.includes(cardId) || memoryFlipped.includes(cardId) || memoryFlipped.length === 2) return;

    const nextFlipped = [...memoryFlipped, cardId];
    setMemoryFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      const pairIdA = nextFlipped[0].split(':')[0];
      const pairIdB = nextFlipped[1].split(':')[0];
      if (pairIdA === pairIdB) {
        const nextMatched = [...memoryMatched, nextFlipped[0], nextFlipped[1]];
        setMemoryMatched(nextMatched);
        setMemoryFlipped([]);
        const totalCards = (activeTestActivity.memoryPairs || []).length * 2;
        if (nextMatched.length === totalCards) {
          setShowWinBadge(true);
          setTimerRunning(false);
          recordActivityScore(activeTestActivity.id, 100);
          setGameMessage('All memory cards matched.');
        } else {
          setGameMessage('Nice match!');
        }
      } else {
        window.setTimeout(() => setMemoryFlipped([]), 700);
      }
    }
  }

  function checkDebateSupport() {
    if (!activeTestActivity || activeTestActivity.activityType !== 'debate') return;
    const evidence = activeTestActivity.debateEvidence || [];
    const picked = evidence.filter((e) => debateSelected.includes(e.id));
    const allPickedAreSupport = picked.every((e) => e.supports);
    const supportCount = evidence.filter((e) => e.supports).length;
    const supportPickedCount = picked.filter((e) => e.supports).length;
    recordActivityScore(activeTestActivity.id, supportCount > 0 ? (supportPickedCount / supportCount) * 100 : 0);
    if (picked.length === supportCount && allPickedAreSupport) {
      setShowWinBadge(true);
      setTimerRunning(false);
      setGameMessage('Strong argument set prepared.');
    } else {
      setGameMessage('Refine your evidence selection for a stronger argument.');
    }
  }

  function scoreTeam(team: 'A' | 'B', correct: boolean) {
    if (!activeTestActivity || activeTestActivity.activityType !== 'team-battle') return;
    const total = (activeTestActivity.teamBattleQuestions || []).length;
    const nextIndex = teamQuestionIndex + 1;
    const nextTeamScores = { ...teamScores, [team]: teamScores[team] + (correct ? 10 : 0) };
    setTeamScores(nextTeamScores);
    setTeamQuestionIndex(nextIndex);
    if (nextIndex >= total) {
      recordActivityScore(activeTestActivity.id, total > 0 ? (Math.max(nextTeamScores.A, nextTeamScores.B) / (total * 10)) * 100 : 0);
      setShowWinBadge(true);
      setTimerRunning(false);
      setGameMessage('Team battle round completed.');
    }
  }

  function checkQuizAnswers() {
    if (!activeTestActivity || activeTestActivity.activityType !== 'quiz') return;
    const questions = activeTestActivity.questions || [];
    const total = questions.length;
    let correct = 0;

    questions.forEach((_, index) => {
      if (quizSelections[index] === 1) correct += 1;
    });

    setQuizScore({ correct, total });
    recordActivityScore(activeTestActivity.id, total > 0 ? (correct / total) * 100 : 0);
    if (total > 0 && correct === total) {
      setShowWinBadge(true);
      setGameMessage('Excellent! All quiz answers are correct.');
      return;
    }
    setGameMessage(`Quiz score: ${correct}/${total}`);
  }

  const matchingProgressTotal = activeTestActivity?.matchingPairs?.length || 0;
  const matchingProgress = matchingProgressTotal > 0 ? matchingMatchedIds.length / matchingProgressTotal : 0;
  const matchingScore = Math.round(matchingProgress * 100);
  const orderingPercent = orderingScore ? Math.round((orderingScore.correct / orderingScore.total) * 100) : null;
  const fillBlankAnswers = activeTestActivity?.blankAnswers || [];
  const fillBlankCorrect = fillBlankAnswers.filter((ans, idx) => fillBlankSelections[idx] === ans).length;
  const fillBlankPercent = fillBlankAnswers.length > 0 ? Math.round((fillBlankCorrect / fillBlankAnswers.length) * 100) : null;
  const classificationItems = activeTestActivity?.classificationItems || [];
  const classificationCorrect = classificationItems.filter((it) => classifySelections[it.id] === it.category).length;
  const classificationPercent =
    classificationItems.length > 0 ? Math.round((classificationCorrect / classificationItems.length) * 100) : null;
  const scenarioCurrentNode =
    activeTestActivity?.activityType === 'scenario'
      ? (activeTestActivity.scenarioNodes || []).find((node) => node.id === scenarioNodeId)
      : null;
  const causeEffectPercent = causeEffectScore ? Math.round((causeEffectScore.correct / causeEffectScore.total) * 100) : null;
  const memoryTotalCards = (activeTestActivity?.memoryPairs || []).length * 2;
  const memoryPercent = memoryTotalCards > 0 ? Math.round((memoryMatched.length / memoryTotalCards) * 100) : null;
  const mapPoints = activeTestActivity?.mapPoints || [];
  const mapCorrect = mapPoints.filter((point) => mapSelections[point.id] === point.label).length;
  const mapPercent = mapPoints.length > 0 ? Math.round((mapCorrect / mapPoints.length) * 100) : null;
  const quizPercent = quizScore ? Math.round((quizScore.correct / quizScore.total) * 100) : null;

  return (
    <main className="platform">
      <div className={`layout-shell ${sidebarPosition === 'right' ? 'sidebar-right' : ''}`}>
        <aside className="sidebar card">
          <div className="sidebar-header">
            <p className="eyebrow"></p>
            <h1>EduAI Platform</h1>
            <p>Track subjects, recent activity, and teaching tools from one full-size control panel.</p>
          </div>

          <div className="sidebar-panel">
            <label htmlFor="course-select">Select course</label>
            <select
              id="course-select"
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
            >
              {COURSES.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
            <p className="status">
              {status}
              {loading ? ' (loading...)' : ''}
            </p>
          </div>

          <nav className="top-anchor-nav sidebar-nav" aria-label="Feature navigation">
            <div className="feature-search-box">
              <label htmlFor="feature-search-input">Search functions</label>
              <input
                id="feature-search-input"
                type="search"
                value={featureSearchQuery}
                onChange={(e) => setFeatureSearchQuery(e.target.value)}
                placeholder="Try: teacher, upload, group..."
              />
              {featureSearchQuery.trim() && (
                <div className="feature-search-results" role="listbox" aria-label="Matched platform functions">
                  {matchedFeatureMenu.length > 0 ? (
                    matchedFeatureMenu.map((featureId) => (
                      <button
                        key={`search-${featureId}`}
                        type="button"
                        className="feature-search-result"
                        onClick={() => {
                          setActiveFeature(featureId);
                          setFeatureSearchQuery('');
                          setSettingsPanelOpen(false);
                        }}
                      >
                        <span className="feature-search-result-label">{featureLabelMap[featureId]}</span>
                        <small>{featureDescriptionMap[featureId]}</small>
                      </button>
                    ))
                  ) : (
                    <p className="feature-search-empty">No matching functions found.</p>
                  )}
                </div>
              )}
            </div>

            {!isFeatureSearchActive && visibleFeatureMenu.map((featureId) => (
              <button
                key={featureId}
                className={`feature-nav-btn ${activeFeature === featureId ? 'active' : ''}`}
                onClick={() => {
                  setActiveFeature(featureId);
                  setSettingsPanelOpen(false);
                }}
              >
                <span className="feature-nav-copy">
                  <span className="feature-nav-label">{featureLabelMap[featureId]}</span>
                  <span><small className="feature-nav-description">{featureDescriptionMap[featureId]}</small></span>
                </span>
              </button>
            ))}
          </nav>

          <div className="sidebar-panel sidebar-summary">
            <div className="card-head">
              <h2>{selectedCourse.code}</h2>
              <span>{selectedCourse.lecturer}</span>
            </div>
            <p>{selectedCourse.name}</p>
            <small>{selectedCourse.resources.length} core resources available</small>
          </div>
        </aside>

        <div className="page-content">
          <header className="hero">
            <div className="hero-copy">
              <p className="eyebrow">EduAI Learning Platform</p>
              <h1>Teacher-guided GenAI Learning Experience</h1>
              <p>
                Student-centered, course-specific support powered by uploaded materials, lecture context, and
                assessment criteria.
              </p>
            </div>

            <div className="hero-controls">
              <button
                type="button"
                className="hero-settings-button"
                aria-label={settingsPanelOpen ? 'Close settings' : 'Open settings'}
                aria-expanded={settingsPanelOpen}
                aria-controls="hero-settings-screen"
                onClick={() => setSettingsPanelOpen((prev) => !prev)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M12 8.75A3.25 3.25 0 1 0 12 15.25 3.25 3.25 0 0 0 12 8.75Zm8.25 3.25c0-.35-.02-.7-.07-1.04l2-1.56-1.93-3.34-2.42.98a8.33 8.33 0 0 0-1.8-1.04L15.62 3h-3.84l-.41 2.95c-.64.2-1.25.5-1.8.86l-2.34-.93-1.93 3.34 1.92 1.48c-.05.36-.08.73-.08 1.09 0 .36.03.73.08 1.09L3.3 14.36l1.93 3.34 2.34-.93c.55.36 1.16.66 1.8.86l.41 2.95h3.84l.42-2.95c.64-.2 1.24-.5 1.8-.86l2.42.98 1.93-3.34-2-1.56c.05-.34.07-.69.07-1.04ZM12 16.75A4.75 4.75 0 1 1 12 7.25a4.75 4.75 0 0 1 0 9.5Z" />
                </svg>
              </button>

              <div className="hero-badge">
                <span>Active Course</span>
                <strong>{selectedCourse.code}</strong>
                <small>{selectedCourse.name}</small>
              </div>
            </div>
          </header>

          {settingsPanelOpen && (
            <section id="hero-settings-screen" className="hero-settings-screen card">
              <div className="card-head">
                <h2>Platform Settings</h2>
                <button type="button" className="small ghost" onClick={() => setSettingsPanelOpen(false)}>
                  Back to Platform
                </button>
              </div>
              <HeroSettingsPanel
                featureLabelMap={featureLabelMap}
                featureMenuOrder={featureMenuOrder}
                shiftMenuItem={shiftMenuItem}
                customEditMode={customEditMode}
                onToggleCustomEditMode={() => setCustomEditMode((prev) => !prev)}
                toggleCustomLayoutFeature={toggleCustomLayoutFeature}
                shiftCustomLayoutFeature={shiftCustomLayoutFeature}
                customLayout={customLayout}
                sidebarPosition={sidebarPosition}
                onChangeSidebarPosition={setSidebarPosition}
              />
            </section>
          )}

          {!settingsPanelOpen && shouldRenderFeature('dashboard') && (
            <>
              <DashboardOverview
                selectedCourse={selectedCourse}
                selectedCourseId={selectedCourseId}
                courses={COURSES}
                dashboardStats={dashboardStats}
                dashboardActivity={dashboardActivity}
                onSelectCourse={handleCourseChange}
              />

              <section className="toolbar card">
                <label htmlFor="course-select-toolbar">Current course</label>
                <select
                  id="course-select-toolbar"
                  value={selectedCourseId}
                  onChange={(e) => {
                    handleCourseChange(e.target.value);
                  }}
                >
                  {COURSES.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
                <p className="status">
                  {status}
                  {loading ? ' (loading...)' : ''}
                </p>
              </section>
            </>
          )}

          {!settingsPanelOpen && (shouldRenderFeature('virtual-teacher') || shouldRenderFeature('upload-center')) && (
            <section className="grid-layout">
        {shouldRenderFeature('virtual-teacher') && (
          <article id="virtual-teacher" className="card chat-card">
          <div className="card-head">
            <h2>Virtual Teacher</h2>
            <span>{selectedCourse.lecturer}</span>
          </div>

          <div className="course-focus">
            <h3>Course objective</h3>
            <p>{selectedCourse.objective}</p>
          </div>

          <div className="chat-window">
            {chatMessages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`bubble ${msg.role}`}>
                <p>{msg.content}</p>
                <small>{formatTime(msg.createdAt)}</small>
              </div>
            ))}
          </div>

          <div className="chat-input-row">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about core concepts, assignment structure, references, or Padlet themes..."
              rows={3}
            />
            <button onClick={sendMessage} disabled={chatLoading}>
              {chatLoading ? 'Thinking...' : 'Send'}
            </button>
          </div>
          </article>
        )}

        {shouldRenderFeature('upload-center') && (
        <article id="upload-center" className="card upload-card">
          <div className="card-head">
            <h2>Upload Center</h2>
            <span>Knowledge Base Files</span>
          </div>

          <div className="controls">
            <input
              ref={fileInputRef}
              type="file"
              id="file-input"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const filesList = e.currentTarget.files;
                if (!filesList || filesList.length === 0) {
                  setSelectedFileName(null);
                  return;
                }
                setSelectedFileName(
                  filesList.length > 1 ? `${filesList.length} files selected` : filesList[0].name,
                );
                uploadSelectedFiles(filesList);
              }}
            />
            <label htmlFor="file-input" className={loading ? 'disabled' : ''}>
              Upload files
            </label>
            <button onClick={fetchList} disabled={loading} className="ghost">
              Refresh
            </button>
            {selectedFileName && <p className="picked">{selectedFileName}</p>}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button onClick={toggleSortOnName} className="sort">
                      Name {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button onClick={toggleSortOnUpdated} className="sort">
                      Modified {sortKey === 'updated_at' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>Preview</th>
                  <th>Summary</th>
                  <th>Delete</th>
                  <th>Rename</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map(({ f, display }) => (
                  <tr key={f.path}>
                    <td>{display}</td>
                    <td>{f.updated_at ? formatDateTime(f.updated_at) : '-'}</td>
                    <td>
                      <button className="small" onClick={() => openPreview(f, display)}>
                        Open
                      </button>
                    </td>
                    <td>
                      <button className="small" onClick={() => generateSummary(f, display)} disabled={summaryLoading}>
                        {summaryLoading ? 'Working...' : 'Summarize'}
                      </button>
                    </td>
                    <td>
                      <button className="small ghost" onClick={() => handleDelete(f.path)}>
                        Delete
                      </button>
                    </td>
                    <td>
                      <button className="small ghost" onClick={() => handleRename(f.path)}>
                        Rename
                      </button>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6}>No files yet for this course.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
        )}
      </section>
          )}

      {!settingsPanelOpen && shouldRenderFeature('course-data') && (
      <section id="course-data" className="grid-secondary">
        <article className="card">
          <div className="card-head">
            <h3>Course Materials</h3>
            <span>{materials.length} items</span>
          </div>
          {materialsLoading ? (
            <p>Loading materials...</p>
          ) : materials.length === 0 ? (
            <p>No course materials available yet for {selectedCourse.code}.</p>
          ) : (
            <div className="materials-list">
              {materials.map((material) => (
                <div key={material.id} className="material-item">
                  <div className="material-header">
                    <strong>{material.title}</strong>
                    <span className="material-type">{material.type}</span>
                  </div>
                  {material.description && <p className="material-desc">{material.description}</p>}
                  <small className="material-date">
                    {material.updated_at ? formatDateTime(material.updated_at) : formatDateTime(material.created_at)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="card">
          <div className="card-head">
            <h3>Assignments</h3>
            <span>{assignments.length} active</span>
          </div>
          {assignmentsLoading ? (
            <p>Loading assignments...</p>
          ) : assignments.length === 0 ? (
            <p>No assignments for {selectedCourse.code} at this time.</p>
          ) : (
            <div className="assignments-list">
              {assignments.map((assignment) => {
                const dueDate = new Date(assignment.due_date);
                const now = new Date();
                const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysLeft < 0;
                const isUrgent = daysLeft >= 0 && daysLeft <= 7;

                return (
                  <div key={assignment.id} className="assignment-item">
                    <div className="assignment-header">
                      <strong>{assignment.title}</strong>
                      {isOverdue && <span className="badge overdue">Overdue</span>}
                      {isUrgent && !isOverdue && <span className="badge urgent">Due soon</span>}
                    </div>
                    {assignment.description && <p className="assignment-desc">{assignment.description}</p>}
                    <div className="assignment-footer">
                      <span>Due: {formatDateTime(assignment.due_date)}</span>
                      <span>Max marks: {assignment.max_marks}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
        <article className="card">
          <div className="card-head">
            <h3>Grades Overview</h3>
            <span>{grades.length} grades</span>
          </div>
          {gradesLoading ? (
            <p>Loading grades...</p>
          ) : grades.length === 0 ? (
            <p>No grades available yet for {selectedCourse.code}.</p>
          ) : (
            <div className="grades-list">
              {grades.map((grade) => (
                <div key={grade.id} className="grade-item">
                  <div className="grade-header">
                    <strong>{grade.assignment_id ? 'Assignment Submission' : 'Course Grade'}</strong>
                    <span className="grade-percentage">{grade.percentage}%</span>
                  </div>
                  <div className="grade-bar">
                    <div
                      className="grade-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, grade.percentage))}%`,
                        backgroundColor:
                          grade.percentage >= 80 ? '#10b981' : grade.percentage >= 60 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <div className="grade-details">
                    <span>Marks: {grade.marks_obtained}/{grade.max_marks}</span>
                    {grade.feedback && <p className="grade-feedback">{grade.feedback}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
      )}

      {!settingsPanelOpen && shouldRenderFeature('group-management') && (
      <section className="grid-layout">
        <article id="group-management" className="card">
          <div className="card-head">
            <h2>Study Group Management</h2>
            <span>{projects.length} projects</span>
          </div>

          <div className="group-mgmt-form">
            <div className="group-mgmt-row">
              <label htmlFor="teacher-user-id">Teacher ID:</label>
              <input
                id="teacher-user-id"
                value={currentUserId}
                onChange={(e) => setCurrentUserId(e.target.value)}
                placeholder="Teacher user ID (UUID)"
              />
            </div>
            <div className="group-mgmt-row">
              <label htmlFor="project-name-input">Project Name:</label>
              <input
                id="project-name-input"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
            <div className="group-mgmt-row">
              <label htmlFor="group-count-input">Group Number:</label>
              <input
                id="group-count-input"
                type="number"
                min={1}
                value={groupCountInput}
                onChange={(e) => setGroupCountInput(Math.max(1, Number(e.target.value) || 1))}
                placeholder="Enter number of groups"
              />
            </div>
            <div className="group-mgmt-row">
              <label htmlFor="group-min-input">Students Per Group (Min):</label>
              <input
                id="group-min-input"
                type="number"
                min={1}
                value={minPerGroupInput}
                onChange={(e) => setMinPerGroupInput(Math.max(1, Number(e.target.value) || 1))}
                placeholder="Enter min students"
              />
            </div>
            <div className="group-mgmt-row">
              <label htmlFor="group-max-input">Students Per Group (Max):</label>
              <input
                id="group-max-input"
                type="number"
                min={1}
                value={maxPerGroupInput}
                onChange={(e) => setMaxPerGroupInput(Math.max(1, Number(e.target.value) || 1))}
                placeholder="Enter max students"
              />
            </div>
          </div>

          <div className="controls group-mgmt-actions">
            <button onClick={createProject}>Create Project</button>
            <button className="ghost" onClick={fetchProjects} disabled={projectLoading}>
              {projectLoading ? 'Loading...' : 'Refresh Projects'}
            </button>
          </div>

          <p className="status">{groupUiNotice}</p>

          <div className="group-mgmt-form">
            <div className="group-mgmt-row">
              <label htmlFor="project-select">Project List:</label>
              <select id="project-select" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="controls group-mgmt-actions">
            <button className="ghost" onClick={() => selectedProjectId && fetchGroups(selectedProjectId)} disabled={!selectedProjectId || groupLoading}>
              {groupLoading ? 'Loading...' : 'Refresh Groups'}
            </button>
          </div>

          <div className="controls">
            <div>
              <small>Preset students:</small>
              <p>{PRESET_STUDENTS.join(', ')}</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Members (Student IDs)</th>
                  <th>Capacity</th>
                  <th>Remaining</th>
                  <th>Latest Chat</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td>{group.members.map((m) => m.user_id).join(', ') || '-'}</td>
                    <td>{group.capacity}</td>
                    <td>{Math.max(0, group.capacity - group.memberCount)}</td>
                    <td>{group.latestChatAt ? formatDateTime(group.latestChatAt) : 'No messages yet'}</td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={5}>No groups yet. Create a project first.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      )}

      {!settingsPanelOpen && shouldRenderFeature('clibot-edu') && (
      <section id="clibot-edu" className="card teacher-test-section">
        <div className="teacher-test-left">
          <div className="teacher-test-current-subject">Current Course: {selectedCourse.code}</div>

          <div className="teacher-test-brand">
            <h2>Clibot Edu</h2>
            <p className="teacher-test-brand-subtitle">Teacher-focused Education AI</p>
            <p>
              An education AI designed for teachers. It can generate test questions, mini quizzes, and classroom
              activities from natural-language instructions, supports different activity types, and
              directly displays a ready-to-use test interface on the right side of this platform.
            </p>
          </div>

          <div className="teacher-test-list-wrap">
            <h3>Generated Test Activities</h3>
            <p>Click an activity name to preview it in the right panel.</p>
            <p className="teacher-average-score">Overall average score: {averageCourseScore !== null ? `${averageCourseScore}%` : 'Pending'}</p>
            <ul className="teacher-test-list">
              {currentCourseActivities.length === 0 && (
                <li className="teacher-test-list-empty">
                  No test activities yet for this course. Submit an instruction to create one.
                </li>
              )}
              {currentActivityEntries.map(({ activity, variant }) => (
                <li key={activity.id} className={variant === 'personalized' ? 'teacher-test-item-nested' : ''}>
                  <button
                    className={activeTestActivity?.id === activity.id ? 'teacher-test-item active' : 'teacher-test-item'}
                    onClick={() => {
                      setActiveTestId(activity.id);
                      setTestStatus(variant === 'personalized' ? 'Previewing personalized activity' : 'Previewing saved activity');
                    }}
                  >
                    <span>{activity.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="teacher-test-prompt">
            <label htmlFor="test-prompt-input">AI Instruction Input</label>
            <textarea
              id="test-prompt-input"
              value={testPromptInput}
              onChange={(e) => setTestPromptInput(e.target.value)}
              rows={5}
              placeholder={`Example: Generate a ${selectedCourse.code} multiple-choice quiz with 5 questions.`}
            />
            <div className="teacher-test-prompt-actions">
              <p>Submit your instruction to generate a new test activity for the selected course.</p>
              <button onClick={handleGenerateTestActivity} disabled={testGenerating}>
                {testGenerating ? 'Generating...' : 'Generate Test'}
              </button>
            </div>
            <p className="teacher-test-prompt-tip">
              Tip: try keywords like &quot;matching&quot;, &quot;timeline&quot;, &quot;fill blank&quot;, &quot;scenario&quot;,
              &quot;speed&quot;, &quot;classification&quot;, &quot;cause effect&quot;, &quot;memory&quot;, &quot;debate&quot;, or &quot;team battle&quot;.
            </p>
          </div>

          <div className="teacher-test-prompt teacher-personalize-panel">
            <label htmlFor="personalize-input">Personalize Selected Test</label>
            <textarea
              id="personalize-input"
              value={personalizeInput}
              onChange={(e) => setPersonalizeInput(e.target.value)}
              rows={4}
              placeholder="Example: Make the questions easier and focus on lecture concepts only."
              disabled={!activeTestActivity}
            />
            <div className="teacher-test-prompt-actions">
              <p>Customize the currently selected generated test.</p>
              <button onClick={handlePersonalizeActivity} disabled={!activeTestActivity}>
                Personalize
              </button>
            </div>
          </div>

          <div className="teacher-test-prompt teacher-lab-panel">
            <label htmlFor="interactive-lab-input">Generate Interactive Lab</label>
            <textarea
              id="interactive-lab-input"
              value={interactiveLabInput}
              onChange={(e) => setInteractiveLabInput(e.target.value)}
              rows={4}
              placeholder="Example: Create an HCI lab where students compare two UI layouts, rate clarity, and explain which design is better for beginners."
            />
            <div className="teacher-test-prompt-actions">
              <p>
                Ask for a compare-and-rate lab or tutorial. If the topic is not suitable, the AI will suggest using the
                quiz generator instead.
              </p>
              <button onClick={handleGenerateInteractiveLab} disabled={interactiveLabGenerating}>
                {interactiveLabGenerating ? 'Generating...' : 'Generate Lab'}
              </button>
            </div>
            <p className="teacher-test-prompt-tip">The lab uses recent student performance to tune the difficulty and guidance.</p>

            {labStatus && labStatus !== 'Waiting for instruction' && <p className="teacher-lab-status">{labStatus}</p>}

            {interactiveLabPlan && (
              <div className="teacher-lab-result">
                <div className="teacher-lab-result-head">
                  <span className="teacher-chip">{interactiveLabPlan.mode === 'lab' ? 'Interactive Lab' : 'Quiz fallback'}</span>
                  <span>{interactiveLabPlan.reason}</span>
                </div>
                <h4>{interactiveLabPlan.title}</h4>
                <p>{interactiveLabPlan.summary}</p>
                <p className="teacher-lab-history">{interactiveLabPlan.personalizationHint}</p>

                {interactiveLabPlan.mode === 'lab' && interactiveLabPlan.lab && (
                  <div className="teacher-lab-workbench">
                    <div className="teacher-lab-section">
                      <strong>Objective</strong>
                      <p>{interactiveLabPlan.lab.objective}</p>
                    </div>

                    <div className="teacher-lab-section">
                      <strong>Compare prompt</strong>
                      <p>{interactiveLabPlan.lab.comparePrompt}</p>
                    </div>

                    <div className="teacher-lab-layouts">
                      {interactiveLabPlan.lab.layouts.map((layout) => {
                        const rating = interactiveLabRatings[layout.id] || 0;
                        return (
                          <article key={layout.id} className="teacher-lab-layout-card">
                            <h5>{layout.name}</h5>
                            <p>{layout.description}</p>
                            <small>{layout.compareFocus}</small>
                            <div className="teacher-lab-rating-row">
                              <span>Rate</span>
                              <div>
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={`${layout.id}-${value}`}
                                    className={`teacher-lab-rating ${rating === value ? 'selected' : ''}`}
                                    onClick={() =>
                                      setInteractiveLabRatings((prev) => ({
                                        ...prev,
                                        [layout.id]: value,
                                      }))
                                    }
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {rating > 0 && <p className="teacher-lab-rating-note">Current rating: {rating}/5</p>}
                          </article>
                        );
                      })}
                    </div>

                    <div className="teacher-lab-section">
                      <strong>Student steps</strong>
                      <ol>
                        {interactiveLabPlan.lab.studentSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="teacher-lab-section">
                      <strong>Rating guide</strong>
                      <ul>
                        {interactiveLabPlan.lab.ratingScale.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="teacher-lab-section">
                      <strong>Reflection questions</strong>
                      <ul>
                        {interactiveLabPlan.lab.reflectionQuestions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {labAverageRating !== null && <p className="teacher-lab-rating-summary">Average rating: {labAverageRating}/5</p>}
                  </div>
                )}

                {interactiveLabPlan.mode === 'quiz' && interactiveLabPlan.quiz && (
                  <div className="teacher-lab-fallback">
                    <strong>Use quiz instead</strong>
                    <p>{interactiveLabPlan.quiz.note}</p>
                    <button className="small" onClick={() => applyQuizFallbackPrompt(interactiveLabPlan.quiz!.suggestedPrompt)}>
                      Load quiz prompt
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="teacher-test-right">
          <div className="teacher-test-header">
            <div>
              <h2>AI Generated Test Activity</h2>
              <p>Course: {selectedCourse.code} - {selectedCourse.name}</p>
              {averageCourseScore !== null && <p className="teacher-average-score">Average score: {averageCourseScore}%</p>}
            </div>
            <div className="teacher-test-header-chips">
              {timeLeftSec !== null && <span className="teacher-chip">Time: {formatDuration(timeLeftSec)}</span>}
              {activeTestActivity?.activityType === 'matching' && <span className="teacher-chip">Score: {matchingScore}</span>}
              {activeTestActivity?.activityType === 'ordering' && orderingPercent !== null && (
                <span className="teacher-chip">Score: {orderingPercent}</span>
              )}
              {activeTestActivity?.activityType === 'fill-blank' && fillBlankPercent !== null && (
                <span className="teacher-chip">Score: {fillBlankPercent}</span>
              )}
              {activeTestActivity?.activityType === 'classification' && classificationPercent !== null && (
                <span className="teacher-chip">Score: {classificationPercent}</span>
              )}
              {activeTestActivity?.activityType === 'cause-effect' && causeEffectPercent !== null && (
                <span className="teacher-chip">Score: {causeEffectPercent}</span>
              )}
              {activeTestActivity?.activityType === 'map-label' && mapPercent !== null && (
                <span className="teacher-chip">Score: {mapPercent}</span>
              )}
              {activeTestActivity?.activityType === 'memory' && memoryPercent !== null && (
                <span className="teacher-chip">Score: {memoryPercent}</span>
              )}
              {activeTestActivity?.activityType === 'speed-challenge' && <span className="teacher-chip">Score: {speedScore}</span>}
              {activeTestActivity?.activityType === 'team-battle' && (
                <span className="teacher-chip">A {teamScores.A} - B {teamScores.B}</span>
              )}
              {activeTestActivity?.activityType === 'quiz' && quizPercent !== null && (
                <span className="teacher-chip">Score: {quizPercent}</span>
              )}
              <span>{testStatus}</span>
            </div>
          </div>

          {activeTestActivity ? (
            <div className="teacher-test-result">
              <div className="teacher-test-meta">
                <h3>{activeTestActivity.title}</h3>
                <p>{activeTestActivity.instructionSummary}</p>
                <span className="teacher-test-type">Type: {activeTestActivity.activityType}</span>
              </div>

              {showWinBadge && <div className="teacher-win-badge">Activity Cleared!</div>}

              {activeTestActivity.activityType === 'quiz' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Select one answer for each question and press Check Answers.</p>
                    <div className="teacher-ordering-actions">
                      <button className="small" onClick={checkQuizAnswers}>
                        Check Answers
                      </button>
                      <button className="small ghost" onClick={resetCurrentGame}>
                        Reset Quiz
                      </button>
                    </div>
                  </div>
                  <ol className="teacher-test-questions">
                    {(activeTestActivity.questions || []).map((question, index) => (
                      <motion.li
                        key={`${activeTestActivity.id}-${index}`}
                        className="teacher-test-question-item"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          rotateY: quizSelections[index] !== undefined ? 2 : 0,
                        }}
                        transition={{ delay: index * 0.06 }}
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <p>Q{index + 1}. {question.question}</p>
                        <ul className="teacher-quiz-options">
                          {question.options.map((option, optionIndex) => (
                            <li key={`${activeTestActivity.id}-${index}-${optionIndex}`}>
                              <motion.button
                                className={`teacher-quiz-option ${quizSelections[index] === optionIndex ? 'selected' : ''}`}
                                onClick={() => {
                                  setQuizSelections((prev) => ({ ...prev, [index]: optionIndex }));
                                }}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                {option}
                              </motion.button>
                            </li>
                          ))}
                        </ul>
                      </motion.li>
                    ))}
                  </ol>
                  {quizScore && (
                    <p className="teacher-ordering-score">
                      Correct answers: {quizScore.correct}/{quizScore.total}
                    </p>
                  )}
                </div>
              )}

              {activeTestActivity.activityType === 'matching' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>
                      Match each prompt with the correct answer. Matched: {matchingMatchedIds.length}/
                      {(activeTestActivity.matchingPairs || []).length}
                    </p>
                    <button className="small ghost" onClick={resetCurrentGame}>
                      Reset Game
                    </button>
                  </div>
                  <div className="teacher-matching-grid">
                    <ul>
                      {(activeTestActivity.matchingPairs || []).map((pair) => (
                        <li key={`${activeTestActivity.id}-prompt-${pair.id}`}>
                          <button
                            className={`teacher-matching-btn ${matchingSelectedPrompt === pair.id ? 'selected' : ''} ${matchingMatchedIds.includes(pair.id) ? 'matched' : ''}`}
                            onClick={() => {
                              if (matchingMatchedIds.includes(pair.id)) return;
                              setMatchingSelectedPrompt(pair.id);
                              setGameMessage('Now choose the matching answer.');
                            }}
                          >
                            {pair.prompt}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <ul>
                      {matchingRightPool.map((pair) => (
                        <li key={`${activeTestActivity.id}-answer-${pair.id}`}>
                          <button
                            className={`teacher-matching-btn ${matchingMatchedIds.includes(pair.id) ? 'matched' : ''}`}
                            onClick={() => handleMatchingAnswer(pair.id)}
                          >
                            {pair.answer}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeTestActivity.activityType === 'ordering' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Arrange the timeline by dragging each step to the correct order.</p>
                    <div className="teacher-ordering-actions">
                      <button className="small" onClick={checkOrderingAnswer}>
                        Check Sequence
                      </button>
                      <button className="small ghost" onClick={resetCurrentGame}>
                        Reset Game
                      </button>
                    </div>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOrderingDragEnd}>
                    <SortableContext items={orderingCurrent} strategy={verticalListSortingStrategy}>
                      <ol className="teacher-ordering-list">
                        {orderingCurrent.map((item) => (
                          <SortableTimelineItem key={`${activeTestActivity.id}-ordering-${item}`} id={item} label={item} />
                        ))}
                      </ol>
                    </SortableContext>
                  </DndContext>
                  {orderingScore && (
                    <p className="teacher-ordering-score">
                      Correct positions: {orderingScore.correct}/{orderingScore.total}
                    </p>
                  )}
                </div>
              )}

              {activeTestActivity.activityType === 'fill-blank' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Fill each blank with the best option.</p>
                    <button className="small ghost" onClick={resetCurrentGame}>
                      Reset Game
                    </button>
                  </div>
                  <p className="teacher-fill-sentence">{activeTestActivity.blankSentence}</p>
                  <div className="teacher-fill-grid">
                    {fillBlankSelections.map((selection, idx) => (
                      <div key={`${activeTestActivity.id}-blank-${idx}`}>
                        <label>Blank {idx + 1}</label>
                        <select
                          value={selection}
                          onChange={(e) => {
                            const next = [...fillBlankSelections];
                            next[idx] = e.target.value;
                            setFillBlankSelections(next);
                          }}
                        >
                          <option value="">Select answer</option>
                          {(activeTestActivity.blankOptions || []).map((opt) => (
                            <option key={`${activeTestActivity.id}-blank-opt-${opt}`} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button className="small" onClick={checkFillBlankAnswers}>
                    Check Answers
                  </button>
                </div>
              )}

              {activeTestActivity.activityType === 'scenario' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Choose a branch to continue this teaching scenario.</p>
                    <button className="small ghost" onClick={resetCurrentGame}>
                      Reset Scenario
                    </button>
                  </div>
                  {scenarioCurrentNode && (
                    <div className="teacher-scenario-card">
                      <p>{scenarioCurrentNode.prompt}</p>
                      <div className="teacher-scenario-choices">
                        {scenarioCurrentNode.choices.length === 0 && <span>Scenario complete.</span>}
                        {scenarioCurrentNode.choices.map((choice, idx) => (
                          <button key={`${activeTestActivity.id}-scenario-choice-${idx}`} onClick={() => handleScenarioChoice(choice)}>
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {scenarioTrace.length > 0 && <p className="teacher-trace">Path: {scenarioTrace.join(' -> ')}</p>}
                </div>
              )}

              {activeTestActivity.activityType === 'speed-challenge' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-speed-hud">
                    <div>
                      <small>Question</small>
                      <strong>
                        {Math.min(speedIndex + 1, (activeTestActivity.speedQuestions || []).length)}/
                        {(activeTestActivity.speedQuestions || []).length}
                      </strong>
                    </div>
                    <div>
                      <small>Timer</small>
                      <strong>{timeLeftSec !== null ? formatDuration(timeLeftSec) : '--:--'}</strong>
                    </div>
                    <div>
                      <small>Streak</small>
                      <strong>x{speedStreak}</strong>
                    </div>
                    <div>
                      <small>Score</small>
                      <strong>{speedScore}</strong>
                    </div>
                    <button className="small ghost" onClick={resetCurrentGame}>
                      Reset Speed
                    </button>
                  </div>
                  <AnimatePresence>
                    {speedStreak >= 2 && (
                      <motion.div
                        key={speedComboPulse}
                        className="teacher-combo-badge"
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.28 }}
                      >
                        Combo x{speedStreak}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {speedIndex < (activeTestActivity.speedQuestions || []).length ? (
                    <motion.div
                      key={`${activeTestActivity.id}-speed-card-${speedIndex}`}
                      className="teacher-speed-card"
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <p>{(activeTestActivity.speedQuestions || [])[speedIndex].question}</p>
                      <div className="teacher-speed-options">
                        {(activeTestActivity.speedQuestions || [])[speedIndex].options.map((opt, idx) => (
                          <motion.button
                            key={`${activeTestActivity.id}-speed-${idx}`}
                            onClick={() => answerSpeedChallenge(idx === 1)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            {opt}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <p>Speed challenge completed.</p>
                  )}
                </div>
              )}

              {activeTestActivity.activityType === 'classification' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Classify each item into the best category.</p>
                    <div className="teacher-ordering-actions">
                      <button className="small" onClick={checkClassification}>
                        Check Categories
                      </button>
                      <button className="small ghost" onClick={resetCurrentGame}>
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="teacher-classification-list">
                    {classificationItems.map((item) => (
                      <div key={`${activeTestActivity.id}-classify-${item.id}`}>
                        <span>{item.label}</span>
                        <select
                          value={classifySelections[item.id] || ''}
                          onChange={(e) => setClassifySelections((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        >
                          <option value="">Select category</option>
                          {(activeTestActivity.categories || []).map((category) => (
                            <option key={`${activeTestActivity.id}-category-${category}`} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTestActivity.activityType === 'cause-effect' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Arrange effects to match each cause from top to bottom.</p>
                    <div className="teacher-ordering-actions">
                      <button className="small" onClick={checkCauseEffect}>
                        Check Chain
                      </button>
                      <button className="small ghost" onClick={resetCurrentGame}>
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="teacher-cause-grid">
                    <ul>
                      {(activeTestActivity.causeEffectPairs || []).map((pair, idx) => (
                        <li key={`${activeTestActivity.id}-cause-${idx}`}>{pair.cause}</li>
                      ))}
                    </ul>
                    <ol>
                      {causeEffectOrder.map((effect, idx) => (
                        <li key={`${activeTestActivity.id}-effect-${idx}`}>
                          <span>{effect}</span>
                          <div>
                            <button className="small ghost" onClick={() => moveCauseEffect(idx, 'up')}>
                              Up
                            </button>
                            <button className="small ghost" onClick={() => moveCauseEffect(idx, 'down')}>
                              Down
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {activeTestActivity.activityType === 'map-label' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Map-label activity is currently disabled.</p>
                  </div>
                  <p className="teacher-game-message">Please generate another type such as matching, timeline, quiz, or speed challenge.</p>
                </div>
              )}

              {activeTestActivity.activityType === 'memory' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Flip cards and find matching concept-definition pairs.</p>
                    <button className="small ghost" onClick={resetCurrentGame}>
                      Reset Memory
                    </button>
                  </div>
                  <div className="teacher-memory-grid">
                    {memoryDeck.map((card) => {
                      const revealed = memoryFlipped.includes(card.id) || memoryMatched.includes(card.id);
                      return (
                        <button
                          key={`${activeTestActivity.id}-memory-${card.id}`}
                          className={`teacher-memory-card ${revealed ? 'revealed' : ''}`}
                          onClick={() => flipMemoryCard(card.id)}
                        >
                          {revealed ? card.text : '?'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTestActivity.activityType === 'debate' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>Select evidence cards that best support the claim.</p>
                    <div className="teacher-ordering-actions">
                      <button className="small" onClick={checkDebateSupport}>
                        Validate Argument
                      </button>
                      <button className="small ghost" onClick={resetCurrentGame}>
                        Reset
                      </button>
                    </div>
                  </div>
                  <p className="teacher-debate-claim">Claim: {activeTestActivity.debateClaim}</p>
                  <div className="teacher-debate-cards">
                    {(activeTestActivity.debateEvidence || []).map((evidence) => (
                      <button
                        key={`${activeTestActivity.id}-debate-${evidence.id}`}
                        className={debateSelected.includes(evidence.id) ? 'selected' : ''}
                        onClick={() => {
                          setDebateSelected((prev) =>
                            prev.includes(evidence.id) ? prev.filter((id) => id !== evidence.id) : [...prev, evidence.id],
                          );
                        }}
                      >
                        {evidence.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTestActivity.activityType === 'team-battle' && (
                <div className="teacher-game-wrap">
                  <div className="teacher-game-head">
                    <p>
                      Team Battle Round {Math.min(teamQuestionIndex + 1, (activeTestActivity.teamBattleQuestions || []).length)}/
                      {(activeTestActivity.teamBattleQuestions || []).length}
                    </p>
                    <button className="small ghost" onClick={resetCurrentGame}>
                      Reset Battle
                    </button>
                  </div>
                  {teamQuestionIndex < (activeTestActivity.teamBattleQuestions || []).length ? (
                    <div className="teacher-team-card">
                      <p>{(activeTestActivity.teamBattleQuestions || [])[teamQuestionIndex].question}</p>
                      <div>
                        <button onClick={() => scoreTeam('A', true)}>Team A Correct (+10)</button>
                        <button onClick={() => scoreTeam('B', true)}>Team B Correct (+10)</button>
                        <button className="ghost" onClick={() => scoreTeam('A', false)}>
                          Skip Round
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>Battle completed. Final score: A {teamScores.A} - B {teamScores.B}</p>
                  )}
                </div>
              )}

              {gameMessage && <p className="teacher-game-message">{gameMessage}</p>}
            </div>
          ) : (
            <div className="teacher-test-empty">
              <h3>Ready to Generate</h3>
              <p>
                Select a course and enter an instruction in the left panel. The generated test interface, including
                title, questions, and options, will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
      )}

          {previewUrl && (
            <div className="overlay">
              <div className="modal">
                <header>
                  <strong>{previewName}</strong>
                  <div>
                    <a href={previewUrl} target="_blank" rel="noreferrer">
                      Open in new tab
                    </a>
                    <button
                      onClick={() => {
                        setPreviewUrl(null);
                        setPreviewName(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </header>
                <iframe src={previewUrl} title={previewName || 'preview'} />
              </div>
            </div>
          )}

          {summaryOpen && (
            <div className="overlay">
              <div className="modal summary">
                <header>
                  <strong>AI Summary</strong>
                  <button
                    onClick={() => {
                      setSummaryOpen(false);
                      setSummaryText(null);
                    }}
                  >
                    Close
                  </button>
                </header>
                <section>{summaryText || 'No summary generated.'}</section>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}