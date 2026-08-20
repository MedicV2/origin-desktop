const ORIGIN_GIT = 'https://origin.cursor.com'

function parseOriginRemote(url) {
  if (!url) return null
  const cleaned = String(url).trim().replace(/\.git$/, '')
  const https = cleaned.match(/^https?:\/\/origin\.cursor\.com(?:\/git)?\/([^/]+)\/([^/]+)$/i)
  if (https) return { owner: https[1], name: https[2], fullName: `${https[1]}/${https[2]}` }
  const ssh = cleaned.match(/^git@origin\.cursor\.com:([^/]+)\/([^/]+)$/i)
  if (ssh) return { owner: ssh[1], name: ssh[2], fullName: `${ssh[1]}/${ssh[2]}` }
  return null
}

function parseGithubRemote(url) {
  if (!url) return null
  const cleaned = String(url).trim().replace(/\.git$/, '')
  const https = cleaned.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i)
  if (https) return { owner: https[1], name: https[2] }
  const ssh = cleaned.match(/^git@github\.com:([^/]+)\/([^/]+)$/i)
  if (ssh) return { owner: ssh[1], name: ssh[2] }
  return null
}

function parsePorcelain(text) {
  const files = []
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line) continue
    if (line.startsWith('##')) continue
    const xy = line.slice(0, 2)
    let rest = line.slice(3)
    let orig = null
    let file = rest
    if (rest.includes(' -> ')) {
      const parts = rest.split(' -> ')
      orig = parts[0]
      file = parts[1]
    }
    const x = xy[0]
    const y = xy[1]
    let status = 'M'
    let conflicted = false
    if (xy === '??') status = 'U'
    else if (xy === '!!') continue
    else if (['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(xy)) {
      status = 'C'
      conflicted = true
    } else if (x === 'A' || y === 'A') status = 'A'
    else if (x === 'D' || y === 'D') status = 'D'
    else if (x === 'R' || y === 'R') status = 'R'
    else if (x === 'C' || y === 'C') status = 'A'
    else status = 'M'
    files.push({
      path: file,
      origPath: orig,
      x,
      y,
      status,
      conflicted,
      staged: x !== ' ' && x !== '?',
      unstaged: y !== ' ' || xy === '??',
    })
  }
  return files
}

function parseRepoList(text, originGit = ORIGIN_GIT) {
  const repos = []
  const lines = String(text || '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^([^\s/]+)\/([^\s]+)\s*$/)
    if (m) {
      const url = (lines[i + 1] || '').trim()
      repos.push({
        owner: m[1],
        name: m[2],
        fullName: `${m[1]}/${m[2]}`,
        cloneUrl: url || `${originGit}/${m[1]}/${m[2]}.git`,
      })
    }
  }
  return repos
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function parseRemotes(text) {
  const map = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)/)
    if (!m) continue
    if (!map[m[1]]) map[m[1]] = { name: m[1], fetch: '', push: [] }
    if (m[3] === 'fetch') map[m[1]].fetch = m[2]
    else map[m[1]].push.push(m[2])
  }
  return Object.values(map)
}

function parseLog(text) {
  return String(text || '')
    .split('\x1e')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [sha, short, author, email, at, subject, parents] = s.split('\x1f')
      return {
        sha,
        short,
        author,
        email,
        at: Number(at) * 1000,
        subject,
        parents: (parents || '').split(' ').filter(Boolean),
      }
    })
}

function parseNameStatus(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t')
      const code = parts[0][0]
      const file = parts[2] || parts[1]
      const status = code === 'A' ? 'A' : code === 'D' ? 'D' : code === 'R' ? 'R' : 'M'
      return { path: file, status }
    })
}

function parseAuthStatus(text) {
  const raw = String(text || '').trim()
  const account = (raw.match(/Account:\s*(.+)/i) || [])[1]?.trim() || ''
  const method = (raw.match(/Auth method:\s*(.+)/i) || [])[1]?.trim() || ''
  const endpoint = (raw.match(/Endpoint:\s*(.+)/i) || [])[1]?.trim() || ''
  const token = /Token:\s*valid/i.test(raw)
  return { account, method, endpoint, token, raw }
}

function parseBranches(text) {
  const local = []
  const remote = []
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line) continue
    const [name, sha, head, upstream, date, subject] = line.split('\x1f')
    const item = {
      name,
      sha,
      current: head === '*',
      upstream: upstream || '',
      date: Number(date) || 0,
      subject: subject || '',
      remote: name.startsWith('origin/'),
    }
    if (item.remote) {
      if (name === 'origin/HEAD') continue
      remote.push(item)
    } else local.push(item)
  }
  return { local, remote }
}

module.exports = {
  ORIGIN_GIT,
  parseOriginRemote,
  parseGithubRemote,
  parsePorcelain,
  parseRepoList,
  parseJsonOrNull,
  parseRemotes,
  parseLog,
  parseNameStatus,
  parseAuthStatus,
  parseBranches,
}
