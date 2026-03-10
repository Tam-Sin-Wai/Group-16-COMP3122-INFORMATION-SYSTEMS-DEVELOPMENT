'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type FileItem = {
  name: string
  path: string
  url?: string | null
  updated_at?: string | null
  created_at?: string | null
}

function basename(path: string) {
  if (!path) return path
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

// remove leading numeric-timestamp- prefix if present
function stripTimestampPrefix(filename: string) {
  return filename.replace(/^\d+-/, '')
}

export default function Home() {
  const [status, setStatus] = useState('Frontend running')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<'name' | 'updated_at'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState<string | null>(null)

  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryText, setSummaryText] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // which file's menu is open (path)
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const actionsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { fetchList() }, [])

  async function fetchList() {
    setLoading(true)
    try {
      const res = await fetch('/api/files/list')
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      const list = json.files || []
      setFiles(list)
      setStatus(list.length === 0 ? 'Upload your first file!' : 'Files loaded')
    } catch (err: any) {
      setStatus(`List error: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  // compute friendly display names (strip server timestamp prefixes and add -1, -2 for duplicates)
  const displayNames = useMemo(() => {
    const counts: Record<string, number> = {}
    return files.map((f) => {
      const raw = basename(f.name || f.path || '')
      const base = stripTimestampPrefix(raw)
      if (!counts[base]) {
        counts[base] = 1
        return base
      } else {
        counts[base] += 1
        return `${base}-${counts[base] - 1}`
      }
    })
  }, [files])

  function getPublicUrlFromFile(file: FileItem) {
    if (file.url) return file.url
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    if (!base) return ''
    return `${base.replace(/\/$/, '')}/storage/v1/object/public/documents/${encodeURI(file.path)}`
  }

  // single-file upload helper
  async function uploadSingle(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/files/upload', { method: 'POST', body: fd })
    if (!res.ok) throw new Error(await res.text())
  }

  // queue / sequential uploader for multiple files
  async function uploadSelectedFiles(filesList: FileList | File[]) {
    const count = (filesList as any).length || 0
    if (count === 0) {
      setStatus('No file selected')
      return
    }
    setLoading(true)
    setStatus(`Uploading ${count} files...`)
    try {
      for (let i = 0; i < count; i++) {
        const f = (filesList as any)[i] as File
        setStatus(`Uploading ${i + 1}/${count}: ${f.name}...`)
        await uploadSingle(f)
      }
      await fetchList()
      setStatus(`Uploaded ${count} file${count > 1 ? 's' : ''}`)
      const el = fileInputRef.current
      if (el) el.value = ''
      setSelectedFileName(null)
    } catch (err: any) {
      setStatus(`Upload error: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  // legacy single-button upload - reads from current input and uploads
  async function handleUpload() {
    const el = fileInputRef.current
    const files = el?.files
    if (!files || files.length === 0) {
      setStatus('No file selected')
      return
    }
    await uploadSelectedFiles(files)
  }

  async function handleDelete(path: string) {
    if (!confirm(`Delete "${basename(path)}"?`)) return
    setStatus(`Deleting ${basename(path)}...`)
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (!res.ok) throw new Error(await res.text())
      await fetchList()
      setStatus(`Deleted ${basename(path)}`)
    } catch (err: any) {
      setStatus(`Delete error: ${err.message || err}`)
    } finally {
      setOpenMenuFor(null)
    }
  }

  async function handleRename(oldPath: string) {
    const newBase = prompt('New file name (include extension)', stripTimestampPrefix(basename(oldPath)))
    if (!newBase) return
    const prefix = oldPath.includes('/') ? oldPath.split('/').slice(0, -1).join('/') + '/' : ''
    const newPath = `${prefix}${newBase}`
    setStatus(`Renaming ${basename(oldPath)} → ${newBase}...`)
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath }),
      })
      if (!res.ok) throw new Error(await res.text())
      await fetchList()
      setStatus(`Renamed to ${newBase}`)
    } catch (err: any) {
      setStatus(`Rename error: ${err.message || err}`)
    } finally {
      setOpenMenuFor(null)
    }
  }

  // sort toggle for column header arrow
  function toggleSortOnName() {
    if (sortKey === 'name') {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey('name')
      setSortDir('asc')
    }
  }

  function toggleSortOnUpdated() {
    if (sortKey === 'updated_at') {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey('updated_at')
      setSortDir('desc') // show newest first by default
    }
  }

  const sortedFiles = useMemo(() => {
    const copy = files.map((f, i) => ({ f, display: displayNames[i] }))
    if (sortKey === 'name') {
      copy.sort((a, b) => {
        const cmp = a.display.localeCompare(b.display)
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      copy.sort((a, b) => {
        const ta = a.f.updated_at || a.f.created_at || ''
        const tb = b.f.updated_at || b.f.created_at || ''
        const cmp = (ta || '').localeCompare(tb || '')
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return copy
  }, [files, displayNames, sortKey, sortDir])

  function openPreview(file: FileItem, displayName: string) {
    const url = getPublicUrlFromFile(file)
    if (!url) { setStatus('No preview URL'); return }
    setPreviewUrl(url)
    setPreviewName(displayName)
  }
  function closePreview() { setPreviewUrl(null); setPreviewName(null) }

  async function generateSummary(file: FileItem, displayName: string) {
    setSummaryLoading(true)
    setStatus(`Generating summary for ${displayName}...`)
    try {
      const res = await fetch('/api/files/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path }),
      })
      if (!res.ok) throw new Error(await res.text())
      const j = await res.json()
      setSummaryText(j.summary || String(j))
      setSummaryOpen(true)
      setStatus('Summary generated')
    } catch (err: any) {
      setStatus(`Summary error: ${err.message || err}`)
    } finally {
      setSummaryLoading(false)
    }
  }

  // close menu when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (actionsRef.current && !actionsRef.current.contains(target)) {
        setOpenMenuFor(null)
        setMenuPos(null)
      }
    }
    window.addEventListener('mousedown', onDocClick)
    return () => window.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div className="app-container" style={{ fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1d324b' }}>AI Summary App</h1>

      <div className="controls" style={{ marginBottom: 12 }}>
        <input
          ref={fileInputRef}
          type="file"
          id="file-input"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.currentTarget.files
            if (!files || files.length === 0) {
              setSelectedFileName(null)
              return
            }
            setSelectedFileName(files.length > 1 ? `${files.length} files selected` : files[0].name)
            // auto-upload on selection
            uploadSelectedFiles(files)
          }}
        />
        <label htmlFor="file-input" style={{
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '8px 12px',
          borderRadius: 6,
          cursor: loading ? 'default' : 'pointer',
          fontWeight: 600,
          pointerEvents: loading ? 'none' : 'auto',
          opacity: loading ? 0.6 : 1
        }}>
          Upload
        </label>
       
        <button onClick={fetchList} disabled={loading} style={{ backgroundColor: '#e5e7eb', padding: '8px 10px', borderRadius: 6 }}>Refresh</button>
      </div>

      {/* floating actions dropdown rendered outside the table so it doesn't affect layout */}
      {openMenuFor && menuPos && (
        <div ref={actionsRef} className="floating-actions" style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 2000, minWidth: 160 }}>
          <button
            onClick={() => { handleDelete(openMenuFor); setOpenMenuFor(null); setMenuPos(null) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
          >
            Delete
          </button>
          <button
            onClick={() => { handleRename(openMenuFor || '') ; setOpenMenuFor(null); setMenuPos(null) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Rename
          </button>
        </div>
      )}

      <p style={{ marginTop: 6 }}>{status}{loading ? ' (loading...)' : ''}</p>

      <div style={{ marginTop: 18, overflowX: 'auto' }}>
        <table className="file-table" style={{ width: '100%' }}>
          <colgroup>
            <col style={{ width: '45%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '8px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Name</span>
                  <button onClick={toggleSortOnName} aria-label="sort by name" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </button>
                </div>
              </th>
              <th style={{ padding: '8px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Modified</span>
                  <button onClick={toggleSortOnUpdated} aria-label="sort by updated" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    {sortKey === 'updated_at' ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                  </button>
                </div>
              </th>
              <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Preview</th>
              <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}></th>
              <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map(({ f, display }) => (
              <tr key={f.path} style={{ borderBottom: '1px solid #f1f1f1' }}>
                <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{display}</td>
                <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.updated_at ? new Date(f.updated_at).toLocaleString() : '-'}</td>
                <td className="preview" style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => openPreview(f, display)}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Open
                  </button>
                </td>
                <td className="summary" style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => generateSummary(f, display)}
                    disabled={summaryLoading}
                    style={{
                      backgroundColor: '#2563eb',
                      color: 'white',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: summaryLoading ? 'default' : 'pointer',
                      opacity: summaryLoading ? 0.6 : 1,
                      display: 'inline-block',
                      width: "105%",
                      whiteSpace: 'nowrap',
                    }}
                    title={summaryLoading ? 'Summarizing...' : 'Summarize'}
                  >
                    {summaryLoading ? 'Summarizing...' : 'Summarize'}
                  </button>
                </td>
                <td className="actions" style={{ padding: '8px 6px', position: 'relative', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={(e) => {
                      const el = e.currentTarget as HTMLElement
                      const rect = el.getBoundingClientRect()
                      setMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX })
                      setOpenMenuFor(openMenuFor === f.path ? null : f.path)
                    }}
                    aria-haspopup="true"
                    aria-expanded={openMenuFor === f.path}
                    style={{
                      background: 'transparent',
                      border: '1px solid #e5e7eb',
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    ⋯
                  </button>
                </td>
              </tr>
            ))}
            {files.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: '#666' }}>No files found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {previewUrl && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ width: '85%', height: '85%', background: 'white', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #eee' }}>
              <strong>{previewName}</strong>
              <div>
                <a href={previewUrl} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>Open in new tab</a>
                <button onClick={closePreview} style={{ padding: '6px 10px', borderRadius: 6 }}>Close</button>
              </div>
            </div>
            <div style={{ flex: 1, background: '#fafafa' }}>
              <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 0 }} title={previewName || 'preview'} />
            </div>
          </div>
        </div>
      )}

      {summaryOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="summary-modal" style={{ width: '90%', maxWidth: 800, background: 'white', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #eee' }}>
              <strong>Summary</strong>
              <div>
                <button onClick={() => { setSummaryOpen(false); setSummaryText(null) }} style={{ padding: '6px 10px', borderRadius: 6 }}>Close</button>
              </div>
            </div>
            <div style={{ padding: 16, maxHeight: '70vh', overflow: 'auto' }}>
              {summaryText ? (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{summaryText}</div>
              ) : (
                <div style={{ color: '#666' }}>{summaryLoading ? 'Generating...' : 'No summary available.'}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}