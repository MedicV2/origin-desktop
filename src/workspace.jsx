import { useEffect, useState } from 'react'
import { Icon } from './icons.jsx'
import {
  rel,
  initials,
  avatarColor,
  statusTitle,
  splitPath,
  filterFiles,
  selectedCount,
  diffStats,
  diffEmptyCopy,
  commitTargetLabel,
} from './display.js'
import { languageFromPath, tokenize } from './syntax.js'

export function FilePath({ path }) {
  const { dir, file } = splitPath(path)
  return (
    <span className="filepath" title={path}>
      {dir ? <span className="dir">{dir}</span> : null}
      <span className="file">{file}</span>
    </span>
  )
}

function splitDiffLine(line, kind) {
  if (kind === 'add' || kind === 'del') return { marker: line[0] || '', body: line.slice(1) }
  if (kind === '' && line.startsWith(' ')) return { marker: ' ', body: line.slice(1) }
  return { marker: '', body: line }
}

function CodeBody({ line, kind, lang }) {
  if (kind === 'hunk' || lang === 'text') return line || ' '
  const { marker, body } = splitDiffLine(line, kind)
  const tokens = tokenize(body, lang)
  return (
    <>
      {marker ? <span className="tok-mark">{marker}</span> : null}
      {tokens.map((t, i) => <span className={`tok-${t.type}`} key={i}>{t.text}</span>)}
    </>
  )
}

export function DiffView({ diff, empty, filePath }) {
  if (!diff) {
    return (
      <div className="empty">
        <div className="illustration"><Icon name="file" size={28} /></div>
        <h3>{empty?.title || 'Select a file to review'}</h3>
        <p>{empty?.body || 'Pick a changed file on the left to see a line-by-line diff.'}</p>
      </div>
    )
  }
  if (!diff.trim()) {
    return (
      <div className="empty">
        <div className="illustration"><Icon name="file" size={28} /></div>
        <h3>No textual diff</h3>
        <p>This file may be binary, empty, or unchanged in this view.</p>
      </div>
    )
  }
  const lines = diff.replace(/\r\n/g, '\n').split('\n')
  let a = 0
  let b = 0
  let lang = languageFromPath(filePath)
  return (
    <div className="diff-scroll">
      {lines.map((line, i) => {
        let kind = ''
        let gutter = ''
        if (line.startsWith('+++ b/') || line.startsWith('+++ ')) {
          const next = line.replace(/^\+\+\+\s+(b\/)?/, '')
          if (next && next !== '/dev/null') lang = languageFromPath(next)
        }
        if (line.startsWith('@@')) {
          kind = 'hunk'
          const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/)
          if (m) {
            a = Number(m[1]) - 1
            b = Number(m[2]) - 1
          }
        } else if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('new file') || line.startsWith('deleted file') || line.startsWith('\\ ')) {
          kind = 'hunk'
        } else if (line.startsWith('+')) {
          kind = 'add'
          b += 1
          gutter = `    ${b}`
        } else if (line.startsWith('-')) {
          kind = 'del'
          a += 1
          gutter = `${a}    `
        } else {
          a += 1
          b += 1
          gutter = `${a} ${b}`
        }
        return (
          <div className={`diff-line ${kind}`} key={i}>
            <span className="gutter">{gutter}</span>
            <span className="code"><CodeBody line={line} kind={kind} lang={lang} /></span>
          </div>
        )
      })}
    </div>
  )
}

export function Workspace({
  sidebarW,
  onResize,
  tab,
  onTab,
  status,
  fileFilter,
  onFileFilter,
  checked,
  onChecked,
  selectedFile,
  onSelectFile,
  summary,
  onSummary,
  description,
  onDescription,
  onCommit,
  busy,
  commits,
  selectedCommit,
  onSelectCommit,
  commitFiles,
  onSelectCommitFile,
  diff,
  onDiscard,
}) {
  const [filesOpen, setFilesOpen] = useState(true)
  const [filesH, setFilesH] = useState(168)
  const [filesAnim, setFilesAnim] = useState(false)
  useEffect(() => { setFilesOpen(true) }, [selectedCommit])
  const files = filterFiles(status?.files || [], fileFilter)
  const checkedCount = selectedCount(status?.files || [], checked)
  const stats = diffStats(diff)
  function onFilesResize(e) {
    e.preventDefault()
    e.stopPropagation()
    setFilesAnim(false)
    const startY = e.clientY
    const startH = filesH
    const move = (ev) => setFilesH(Math.min(420, Math.max(80, startH + (ev.clientY - startY))))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  return (
    <div className="workspace">
      <div className="sidebar" style={{ width: sidebarW }}>
        <div className="sidebar-resizer" onMouseDown={onResize} />
        <div className="tabs">
          <button className={`tab ${tab === 'changes' ? 'active' : ''}`} onClick={() => onTab('changes')}>
            Changes {status?.files?.length ? <span className="count">{status.files.length}</span> : null}
          </button>
          <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => onTab('history')}>History</button>
        </div>
        {tab === 'changes' ? (
          <Changes
            status={status}
            files={files}
            fileFilter={fileFilter}
            onFileFilter={onFileFilter}
            checked={checked}
            onChecked={onChecked}
            checkedCount={checkedCount}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            summary={summary}
            onSummary={onSummary}
            description={description}
            onDescription={onDescription}
            onCommit={onCommit}
            busy={busy}
          />
        ) : (
          <History commits={commits} selectedCommit={selectedCommit} onSelectCommit={onSelectCommit} />
        )}
      </div>
      <div className="diff-pane">
        <div className="diff-header">
          <Icon name="file" />
          {selectedFile ? <FilePath path={selectedFile} /> : (
            <span className="path">{selectedCommit ? commits.find((c) => c.sha === selectedCommit)?.subject : 'Review changes'}</span>
          )}
          {diff && (stats.added || stats.removed) ? (
            <span className="diff-stats">
              <span className="add">+{stats.added}</span>
              <span className="del">−{stats.removed}</span>
            </span>
          ) : null}
          {selectedFile && tab === 'changes' && (
            <button className="btn link" onClick={onDiscard}>Discard</button>
          )}
        </div>
        {tab === 'history' && selectedCommit && commitFiles.length > 0 && (
          <div
            className={`diff-files ${filesOpen ? '' : 'collapsed'}${filesAnim ? ' is-animating' : ''}`}
            style={{ height: filesOpen ? filesH : 34 }}
          >
            <button
              className="diff-files-head"
              onClick={() => {
                setFilesAnim(true)
                setFilesOpen((open) => !open)
              }}
              title={filesOpen ? 'Collapse file list' : 'Expand file list'}
            >
              <Icon name="arrow-down" className="chev" />
              <span>{commitFiles.length} file{commitFiles.length === 1 ? '' : 's'} changed</span>
              {selectedFile && !filesOpen ? <FilePath path={selectedFile} /> : null}
            </button>
            <div className="diff-files-list">
              {commitFiles.map((f) => (
                <div
                  key={f.path}
                  className={`file-row ${selectedFile === f.path ? 'selected' : ''}`}
                  onClick={() => onSelectCommitFile(f.path)}
                >
                  <FilePath path={f.path} />
                  <span className={`status-letter ${f.status}`}>{f.status}</span>
                </div>
              ))}
            </div>
            {filesOpen ? <div className="diff-files-resizer" onMouseDown={onFilesResize} /> : null}
          </div>
        )}
        <DiffView
          diff={diff}
          filePath={selectedFile}
          empty={diffEmptyCopy({
            tab,
            hasFiles: Boolean(status?.files?.length),
            hasSelection: Boolean(selectedFile || selectedCommit),
          })}
        />
      </div>
    </div>
  )
}

function Changes({
  status, files, fileFilter, onFileFilter, checked, onChecked, checkedCount,
  selectedFile, onSelectFile, summary, onSummary, description, onDescription,
  onCommit, busy,
}) {
  const all = status?.files || []
  return (
    <>
      {all.some((f) => f.conflicted) && (
        <div className="banner"><Icon name="alert" />This branch has merge conflicts that must be resolved before committing.</div>
      )}
      {all.length > 0 && (
        <div className="filter-row">
          <div className="filter-wrap">
            <Icon name="search" className="search-ic" />
            <input placeholder="Filter files" value={fileFilter} onChange={(e) => onFileFilter(e.target.value)} />
          </div>
        </div>
      )}
      {all.length > 0 && (
        <div className="changes-meta">
          <span>{checkedCount} of {all.length} selected</span>
          <button
            onClick={() => {
              const allOn = checkedCount === all.length
              const next = {}
              for (const f of all) next[f.path] = !allOn
              onChecked(next)
            }}
          >
            {checkedCount === all.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      )}
      <div className="file-list">
        {files.length === 0 && (
          <div className="empty">
            <div className="illustration"><Icon name="check" size={28} /></div>
            <h3>{fileFilter ? 'No matching files' : 'No local changes'}</h3>
            <p>{fileFilter ? 'Try a different filter.' : 'Working tree is clean. Commit, push, or start a new branch when you’re ready.'}</p>
          </div>
        )}
        {files.map((f) => (
          <div key={f.path} className={`file-row ${selectedFile === f.path ? 'selected' : ''}`} onClick={() => onSelectFile(f.path)} title={statusTitle(f.status)}>
            <input
              className="check"
              type="checkbox"
              checked={checked[f.path] !== false}
              onChange={(e) => {
                e.stopPropagation()
                onChecked({ ...checked, [f.path]: e.target.checked })
              }}
            />
            <FilePath path={f.path} />
            <span className={`status-letter ${f.status}`}>{f.status}</span>
          </div>
        ))}
      </div>
      {all.length > 0 ? (
        <div className="commit-box">
          <div className="commit-fields">
            <input
              placeholder="Summary (required)"
              value={summary}
              onChange={(e) => onSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onCommit()
              }}
            />
            <textarea placeholder="Description" value={description} onChange={(e) => onDescription(e.target.value)} />
            <button className="btn block" disabled={!summary.trim() || busy === 'commit' || checkedCount === 0} onClick={onCommit} title={commitTargetLabel(status?.branch?.name)}>
              {busy === 'commit' ? 'Committing…' : commitTargetLabel(status?.branch?.name)}
            </button>
            <div className="commit-hint">
              <span>{checkedCount ? `${checkedCount} file${checkedCount === 1 ? '' : 's'} in this commit` : 'Select files to include'}</span>
              <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
            </div>
          </div>
        </div>
      ) : (
        <div className="commit-box compact">
          <strong title={status?.branch?.name}>{status?.branch?.name || 'No branch'}</strong>
          <span>Nothing to commit</span>
        </div>
      )}
    </>
  )
}

function History({ commits, selectedCommit, onSelectCommit }) {
  return (
    <div className="file-list">
      {commits.length === 0 && (
        <div className="empty">
          <div className="illustration"><Icon name="history" size={28} /></div>
          <h3>No commits yet</h3>
          <p>History will show up here after the first commit.</p>
        </div>
      )}
      {commits.map((c) => (
        <div key={c.sha} className={`commit-row ${selectedCommit === c.sha ? 'selected' : ''}`} onClick={() => onSelectCommit(c)}>
          <div className="avatar" style={{ width: 26, height: 26, fontSize: 10, background: avatarColor(c.author) }}>{initials(c.author)}</div>
          <div className="commit-meta">
            <div className="subject">{c.subject}</div>
            <div className="kicker">{c.author} · {rel(c.at)}</div>
          </div>
          <span className="sha">{c.short}</span>
        </div>
      ))}
    </div>
  )
}
