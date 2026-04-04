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

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'I am your virtual teacher. Ask about lecture concepts, assignment structure, or Padlet discussion themes for this course.',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]);

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
  const [personalizeInput, setPersonalizeInput] = useState('');
  const [personalizedStore, setPersonalizedStore] = useState<Record<string, TestActivity[]>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    fetchList();
    fetchMaterials();
    fetchAssignments();
    fetchGrades();
  }, [selectedCourseId]);

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

  function createMockQuestions(subject: string, promptText: string): TestQuestion[] {
    return [
      {
        question: `What is the best answer to this ${subject.toLowerCase()} concept question based on the instruction?`,
        options: [
          'Option A: Basic understanding',
          'Option B: Applied reasoning',
          'Option C: Incorrect interpretation',
          'Option D: Extended challenge',
        ],
      },
      {
        question: `Which statement most accurately matches the activity goal: "${promptText.trim()}"?`,
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
    ];
  }

  function createMockMatchingPairs(subject: string): MatchingPair[] {
    if (subject.toLowerCase().includes('computer')) {
      return [
        { id: 'c1', prompt: 'Variable', answer: 'Named storage for a value' },
        { id: 'c2', prompt: 'Loop', answer: 'Repeats a block of code' },
        { id: 'c3', prompt: 'Array', answer: 'Ordered list of values' },
        { id: 'c4', prompt: 'Function', answer: 'Reusable block of logic' },
      ];
    }
    return [
      { id: 'g1', prompt: 'Key Concept', answer: `${subject} foundation principle` },
      { id: 'g2', prompt: 'Core Skill', answer: `Applied ${subject.toLowerCase()} problem solving` },
      { id: 'g3', prompt: 'Assessment Focus', answer: 'Reasoning with evidence' },
      { id: 'g4', prompt: 'Common Mistake', answer: 'Skipping step-by-step analysis' },
    ];
  }

  function createMockOrderingItems(subject: string): string[] {
    if (subject.toLowerCase().includes('computer')) {
      return ['Understand requirements', 'Design algorithm', 'Write code', 'Test edge cases', 'Refactor'];
    }
    return ['Review instruction', `Identify ${subject.toLowerCase()} concepts`, 'Draft approach', 'Solve with steps', 'Check answer'];
  }

  function createFillBlankMock(subject: string) {
    if (subject.toLowerCase().includes('computer')) {
      return {
        sentence: 'A function takes ___ and returns an ___ value.',
        answers: ['input', 'output'],
        options: ['input', 'output', 'error', 'loop'],
      };
    }
    return {
      sentence: `A strong ${subject.toLowerCase()} response starts with ___ and includes supporting ___.`,
      answers: ['key idea', 'evidence'],
      options: ['key idea', 'evidence', 'guessing', 'unrelated details'],
    };
  }

  function createScenarioNodes(subject: string): ScenarioNode[] {
    return [
      {
        id: 1,
        prompt: `A student is stuck on a ${subject.toLowerCase()} task. What should happen first?`,
        choices: [
          { label: 'Review key concept notes', next: 2 },
          { label: 'Skip directly to final answer', next: 3 },
        ],
      },
      {
        id: 2,
        prompt: 'Good start. Which support strategy is best next?',
        choices: [
          { label: 'Try one guided practice question', next: 4 },
          { label: 'Memorize without understanding', next: 3 },
        ],
      },
      {
        id: 3,
        prompt: 'Learning quality dropped. Choose a corrective action.',
        choices: [
          { label: 'Return to concept and examples', next: 2 },
          { label: 'Ask peer to explain with steps', next: 4 },
        ],
      },
      {
        id: 4,
        prompt: 'Success path reached. Student can now complete an independent challenge.',
        choices: [],
      },
    ];
  }

  function createClassificationMock(subject: string) {
    if (subject.toLowerCase().includes('computer')) {
      return {
        categories: ['Data', 'Control'],
        items: [
          { id: 'cs1', label: 'Array', category: 'Data' },
          { id: 'cs2', label: 'If statement', category: 'Control' },
          { id: 'cs3', label: 'Object', category: 'Data' },
          { id: 'cs4', label: 'Loop', category: 'Control' },
        ],
      };
    }
    return {
      categories: ['Concept', 'Application'],
      items: [
        { id: 'g1', label: `${subject} definition`, category: 'Concept' },
        { id: 'g2', label: `${subject} case study`, category: 'Application' },
        { id: 'g3', label: 'Core terminology', category: 'Concept' },
        { id: 'g4', label: 'Problem-solving steps', category: 'Application' },
      ],
    };
  }

  function createCauseEffectPairs(subject: string) {
    return [
      { cause: `Strong foundation in ${subject.toLowerCase()} concepts`, effect: 'Higher confidence in solving tasks' },
      { cause: 'Regular formative feedback', effect: 'Faster learning adjustments' },
      { cause: 'Collaborative practice sessions', effect: 'Better problem-solving quality' },
    ];
  }

  function createMapPoints(subject: string) {
    return [
      { id: 'p1', location: 'Point A', label: `${subject} Concept Hub` },
      { id: 'p2', location: 'Point B', label: 'Practice Zone' },
      { id: 'p3', location: 'Point C', label: 'Assessment Checkpoint' },
    ];
  }

  function createDebateMock(subject: string) {
    return {
      claim: `Schools should increase project-based ${subject.toLowerCase()} learning time.`,
      evidence: [
        { id: 'd1', text: 'Student engagement rises in applied tasks.', supports: true },
        { id: 'd2', text: 'No planning is required for projects.', supports: false },
        { id: 'd3', text: 'Concept retention improves with active practice.', supports: true },
        { id: 'd4', text: 'Assessment quality always decreases.', supports: false },
      ],
    };
  }

  async function generateTestActivityFromAI(subject: string, promptText: string) {
    // AI_API_PLACEHOLDER_TOKEN
    // Insert your AI API integration here and return:
    // { title, instructionSummary, activityType, questions?, matchingPairs?, orderingItems? }.
    return new Promise<Omit<TestActivity, 'id'>>((resolve) => {
      setTimeout(() => {
        const activityType = detectActivityType(promptText);

        if (activityType === 'matching') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 180,
            matchingPairs: createMockMatchingPairs(subject),
          });
          return;
        }

        if (activityType === 'ordering') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 150,
            orderingItems: createMockOrderingItems(subject),
          });
          return;
        }

        if (activityType === 'fill-blank') {
          const fill = createFillBlankMock(subject);
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
            scenarioNodes: createScenarioNodes(subject),
          });
          return;
        }

        if (activityType === 'speed-challenge') {
          resolve({
            title: buildActivityName(subject, promptText),
            instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
            activityType,
            timeLimitSec: 90,
            speedQuestions: createMockQuestions(subject, promptText),
          });
          return;
        }

        if (activityType === 'classification') {
          const classification = createClassificationMock(subject);
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
          const pairs = createCauseEffectPairs(subject);
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
            memoryPairs: createMockMatchingPairs(subject),
          });
          return;
        }

        if (activityType === 'debate') {
          const debate = createDebateMock(subject);
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
            teamBattleQuestions: createMockQuestions(subject, promptText),
          });
          return;
        }

        resolve({
          title: buildActivityName(subject, promptText),
          instructionSummary: `Generated from instruction: "${promptText.trim()}"`,
          activityType,
          timeLimitSec: 0,
          questions: createMockQuestions(subject, promptText),
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
      <section className="toolbar card">
        <label htmlFor="course-select">Select course</label>
        <select
          id="course-select"
          value={selectedCourseId}
          onChange={(e) => {
            setSelectedCourseId(e.target.value);
            setActiveTestId(null);
            setTestStatus('Waiting for instruction');
            setChatMessages([
              {
                role: 'assistant',
                content:
                  'I am your virtual teacher. Ask about lecture concepts, assignment structure, or Padlet discussion themes for this course.',
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ]);
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

      <header className="hero">
        <div>
          <p className="eyebrow">EduAI Learning Platform</p>
          <h1>Teacher-guided GenAI Learning Experience</h1>
          <p>
            Student-centered, course-specific support powered by uploaded materials, lecture context, and
            assessment criteria.
          </p>
        </div>
        <div className="hero-badge">
          <span>Active Course</span>
          <strong>{selectedCourse.code}</strong>
          <small>{selectedCourse.name}</small>
        </div>
      </header>

      <section className="grid-layout">
        <article className="card chat-card">
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

        <article className="card upload-card">
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
      </section>

      <section className="grid-secondary">
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

      <section className="card teacher-test-section">
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
    </main>
  );
}