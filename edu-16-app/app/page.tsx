'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
};

function basename(path: string) {
  if (!path) return path;
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function stripTimestampPrefix(filename: string) {
  return filename.replace(/^\d+-/, '');
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'I am your virtual teacher. Ask about lecture concepts, assignment structure, or Padlet discussion themes for this course.',
    },
  ]);

  useEffect(() => {
    fetchList();
  }, [selectedCourseId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (actionsRef.current && !actionsRef.current.contains(target)) {
        setOpenMenuFor(null);
        setMenuPos(null);
      }
    }
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, []);

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
    } finally {
      setOpenMenuFor(null);
      setMenuPos(null);
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
    } finally {
      setOpenMenuFor(null);
      setMenuPos(null);
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

    const nextMessages = [...chatMessages, { role: 'user' as const, content: message }];
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
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.response || 'No response' }]);
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : String(err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I cannot reach the AI service right now. Here is a fallback suggestion: Review the latest lecture summary and assignment criteria for ${selectedCourse.code}. Error: ${messageText}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="platform">
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

      <section className="toolbar card">
        <label htmlFor="course-select">Select course</label>
        <select
          id="course-select"
          value={selectedCourseId}
          onChange={(e) => {
            setSelectedCourseId(e.target.value);
            setChatMessages([
              {
                role: 'assistant',
                content:
                  'I am your virtual teacher. Ask about lecture concepts, assignment structure, or Padlet discussion themes for this course.',
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
                <small>{formatTime(new Date().toISOString())}</small>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map(({ f, display }) => (
                  <tr key={f.path}>
                    <td>{display}</td>
                    <td>{f.updated_at ? new Date(f.updated_at).toLocaleString() : '-'}</td>
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
                      <button
                        className="small ghost"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                          setOpenMenuFor(openMenuFor === f.path ? null : f.path);
                        }}
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5}>No files yet for this course.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid-secondary">
        <article className="card placeholder">
          <h3>Assignments Assistant</h3>
          <p>
            UI prepared. Backend coming next sprint: rubric alignment, submission planning, and integrity-safe
            writing support.
          </p>
        </article>
        <article className="card placeholder">
          <h3>Padlet Discussion Insights</h3>
          <p>
            UI prepared. Backend coming next sprint: discussion summarization, trend extraction, and e-consultation
            highlights.
          </p>
        </article>
        <article className="card placeholder">
          <h3>Study Group Hub</h3>
          <p>
            UI prepared. Backend coming next sprint: group rooms, peer collaboration tracking, and @AI group support.
          </p>
        </article>
      </section>

      {openMenuFor && menuPos && (
        <div ref={actionsRef} className="floating-menu" style={{ top: menuPos.top, left: menuPos.left }}>
          <button onClick={() => handleDelete(openMenuFor)}>Delete</button>
          <button onClick={() => handleRename(openMenuFor)}>Rename</button>
        </div>
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
    </main>
  );
}