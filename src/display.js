/** How Origin Desktop presents git and Origin facts in the UI. */

export const THEMES = [
  { id: 'paper', label: 'Paper', swatch: ['#f7f5f2', '#e05a2b'] },
  { id: 'midnight', label: 'Midnight', swatch: ['#141210', '#f07545'] },
  { id: 'cursor', label: 'Cursor', swatch: ['#0a0a0a', '#e5e5e5'] },
  { id: 'ocean', label: 'Ocean', swatch: ['#0b1220', '#38bdf8'] },
  { id: 'forest', label: 'Forest', swatch: ['#102116', '#4ade80'] },
  { id: 'ember', label: 'Ember', swatch: ['#1c1012', '#fb7185'] },
  { id: 'slate', label: 'Slate', swatch: ['#22272e', '#6ea8d8'] },
]

export function resolveTheme(id, prefersDark = false) {
  if (id === 'dark') return 'midnight'
  if (id === 'contrast') return 'slate'
  if (id === 'light' || id === 'system' || !id) return prefersDark ? 'midnight' : 'paper'
  return THEMES.some((t) => t.id === id) ? id : 'paper'
}

export function rel(ts, now = Date.now()) {
  if (!ts) return ''
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(ts).toLocaleDateString()
}

export function initials(name) {
  const p = String(name || 'O').trim().split(/\s+/)
  return ((p[0]?.[0] || 'O') + (p[1]?.[0] || '')).toUpperCase()
}

export function accountHandle(account) {
  if (!account) return 'You'
  return String(account).split('@')[0]
}

export function splitPath(p) {
  const normalized = String(p || '').replace(/\\/g, '/')
  const i = normalized.lastIndexOf('/')
  if (i < 0) return { dir: '', file: normalized }
  return { dir: normalized.slice(0, i + 1), file: normalized.slice(i + 1) }
}

const AVATAR_COLORS = ['#E05A2B', '#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#be123c']

export function avatarColor(seed) {
  const s = String(seed || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function statusTitle(code) {
  return (
    {
      A: 'Added',
      M: 'Modified',
      D: 'Deleted',
      R: 'Renamed',
      U: 'Untracked',
      C: 'Conflicted',
    }[code] || 'Changed'
  )
}

export function syncAction(status) {
  if (!status) return { id: 'fetch', label: 'Fetch origin', icon: 'sync' }
  if (!status.isOrigin && !(status.remotes && status.remotes.length)) {
    return { id: 'publish-repo', label: 'Publish repository', icon: 'arrow-up' }
  }
  if (!status.upstream) return { id: 'publish', label: 'Publish branch', icon: 'arrow-up' }
  const ahead = Number(status.ahead) || 0
  const behind = Number(status.behind) || 0
  if (behind > 0 && ahead === 0) {
    return { id: 'pull', label: 'Pull origin', icon: 'arrow-down', count: behind, kind: 'behind' }
  }
  if (ahead > 0 && behind === 0) {
    return { id: 'push', label: 'Push origin', icon: 'arrow-up', count: ahead, kind: 'ahead' }
  }
  if (ahead > 0 && behind > 0) {
    return { id: 'pull', label: 'Pull origin', icon: 'arrow-down', count: behind, kind: 'behind', diverged: true }
  }
  return { id: 'fetch', label: 'Fetch origin', icon: 'sync' }
}

export function diffStats(diff) {
  let added = 0
  let removed = 0
  if (!diff) return { added, removed }
  for (const line of String(diff).replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) continue
    if (line.startsWith('+')) added += 1
    else if (line.startsWith('-')) removed += 1
  }
  return { added, removed }
}

export function filterRepos(repos, query) {
  const list = Array.isArray(repos) ? repos : []
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list
  return list.filter((r) => `${r.fullName || ''} ${r.name || ''} ${r.path || ''}`.toLowerCase().includes(q))
}

export function filterFiles(files, query) {
  const list = Array.isArray(files) ? files : []
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list
  return list.filter((f) => String(f.path || '').toLowerCase().includes(q))
}

export function selectedCount(files, checked) {
  const list = Array.isArray(files) ? files : []
  return list.filter((f) => checked[f.path] !== false).length
}

export function diffEmptyCopy({ tab, hasFiles, hasSelection }) {
  if (tab === 'changes' && !hasFiles) {
    return {
      title: 'Working tree is clean',
      body: 'There are no uncommitted changes in this repository.',
    }
  }
  if (tab === 'history' && !hasSelection) {
    return {
      title: 'Select a commit',
      body: 'Pick a commit on the left to inspect its files and diff.',
    }
  }
  return {
    title: 'Select a file to review',
    body: 'Pick a changed file on the left to see a line-by-line diff.',
  }
}

export function commitTargetLabel(branch) {
  const name = String(branch || 'branch')
  if (name.length <= 28) return `Commit to ${name}`
  return `Commit to …${name.slice(-24)}`
}
