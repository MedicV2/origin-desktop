const fs = require('fs')
const path = require('path')
const { findExecutable, run } = require('./spawn.cjs')
const {
  parseOriginRemote,
  parseGithubRemote,
  parsePorcelain,
  parseRemotes,
  parseLog,
  parseNameStatus,
  parseBranches,
} = require('./parse.cjs')

const GIT = findExecutable([
  process.env.GIT_EXEC_PATH && path.join(process.env.GIT_EXEC_PATH, 'git.exe'),
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  'git',
])

function git(args, cwd, extra = {}) {
  return run(GIT, ['-c', 'core.quotepath=false', '-c', 'color.ui=false', ...args], {
    cwd,
    timeout: extra.timeout,
    env: extra.env,
  })
}

function authorEnv(identity) {
  const env = {}
  if (identity?.gitName) {
    env.GIT_AUTHOR_NAME = identity.gitName
    env.GIT_COMMITTER_NAME = identity.gitName
  }
  if (identity?.gitEmail) {
    env.GIT_AUTHOR_EMAIL = identity.gitEmail
    env.GIT_COMMITTER_EMAIL = identity.gitEmail
  }
  return env
}

async function remotes(cwd) {
  const r = await git(['remote', '-v'], cwd)
  return parseRemotes(r.stdout)
}

async function identity(cwd) {
  const list = await remotes(cwd)
  const originRemote = list.find((x) => x.name === 'origin') || list[0]
  const originInfo = originRemote ? parseOriginRemote(originRemote.fetch) : null
  const githubInfo = originRemote ? parseGithubRemote(originRemote.fetch) : null
  const name = originInfo?.name || githubInfo?.name || path.basename(cwd)
  const owner = originInfo?.owner || githubInfo?.owner || ''
  return {
    path: cwd,
    name,
    owner,
    fullName: owner ? `${owner}/${name}` : name,
    isOrigin: Boolean(originInfo),
    originInfo,
    remotes: list,
    cloneUrl: originRemote?.fetch || '',
  }
}

async function currentBranch(cwd) {
  const r = await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  const name = r.stdout.trim()
  if (!r.ok || name === 'HEAD') {
    const sha = await git(['rev-parse', '--short', 'HEAD'], cwd)
    return { name: 'HEAD', detached: true, sha: sha.stdout.trim() }
  }
  return { name, detached: false, sha: '' }
}

async function aheadBehind(cwd) {
  const r = await git(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], cwd)
  if (!r.ok) return { ahead: 0, behind: 0, upstream: null }
  const [behind, ahead] = r.stdout.trim().split(/\s+/).map((n) => parseInt(n, 10) || 0)
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], cwd)
  return { ahead, behind, upstream: up.ok ? up.stdout.trim() : null }
}

async function listBranches(cwd) {
  const r = await git(
    [
      'for-each-ref',
      '--format=%(refname:short)%1f%(objectname:short)%1f%(HEAD)%1f%(upstream:short)%1f%(committerdate:unix)%1f%(subject)',
      'refs/heads',
      'refs/remotes',
    ],
    cwd
  )
  return parseBranches(r.stdout)
}

async function guessDefaultBranch(cwd, branches) {
  const sym = await git(['symbolic-ref', 'refs/remotes/origin/HEAD'], cwd)
  if (sym.ok) {
    const m = sym.stdout.trim().match(/refs\/remotes\/origin\/(.+)/)
    if (m) return m[1]
  }
  for (const n of ['main', 'master', 'trunk', 'develop']) {
    if (branches.local.some((b) => b.name === n)) return n
  }
  return branches.local.find((b) => b.current)?.name || 'main'
}

async function status(cwd) {
  const [ident, branch, st, branches, stash] = await Promise.all([
    identity(cwd),
    currentBranch(cwd),
    git(['status', '--porcelain=v1', '-uall', '--branch'], cwd),
    listBranches(cwd),
    git(['stash', 'list'], cwd),
  ])
  const ab = branch.detached ? { ahead: 0, behind: 0, upstream: null } : await aheadBehind(cwd)
  const files = parsePorcelain(st.stdout)
  const defaultBranch = await guessDefaultBranch(cwd, branches)
  return {
    ...ident,
    branch,
    ahead: ab.ahead,
    behind: ab.behind,
    upstream: ab.upstream,
    files,
    branches,
    stashCount: stash.stdout.split(/\r?\n/).filter(Boolean).length,
    defaultBranch,
    clean: files.length === 0,
  }
}

async function dispatch(action, payload = {}, identityPrefs = {}) {
  const cwd = payload.path
  const env = authorEnv(identityPrefs)
  switch (action) {
    case 'status':
      return status(cwd)
    case 'identity':
      return identity(cwd)
    case 'isRepo': {
      const r = await git(['rev-parse', '--is-inside-work-tree'], cwd)
      return { ok: r.ok && r.stdout.trim() === 'true' }
    }
    case 'diff': {
      const args = ['diff', '--no-color', '--no-ext-diff']
      if (payload.staged) args.push('--cached')
      if (payload.file) args.push('--', payload.file)
      const r = await git(args, cwd)
      return { ok: r.ok, diff: r.stdout || r.stderr, error: r.ok ? '' : r.stderr }
    }
    case 'show': {
      const args = payload.file
        ? ['show', '--pretty=format:', '--no-color', '--no-ext-diff', payload.sha, '--', payload.file]
        : ['show', '--no-color', '--no-ext-diff', payload.sha]
      const r = await git(args, cwd)
      return { ok: r.ok, diff: r.stdout, error: r.stderr }
    }
    case 'discard': {
      const files = payload.files || [payload.file]
      for (const file of files) {
        const st = await git(['status', '--porcelain=v1', '--', file], cwd)
        if (st.stdout.trim().startsWith('??')) {
          const full = path.join(cwd, file)
          try {
            if (fs.statSync(full).isDirectory()) fs.rmSync(full, { recursive: true, force: true })
            else fs.unlinkSync(full)
          } catch (err) {
            return { ok: false, error: err.message }
          }
        } else {
          await git(['restore', '--worktree', '--source=HEAD', '--', file], cwd)
        }
      }
      return { ok: true }
    }
    case 'commit': {
      const files = payload.files || []
      const all = payload.allFiles || []
      for (const f of all) {
        if (files.includes(f)) await git(['add', '--', f], cwd)
        else await git(['reset', '-q', 'HEAD', '--', f], cwd)
      }
      const msg = (payload.summary || '').trim()
      const body = (payload.description || '').trim()
      const r = await git(['commit', '-m', body ? `${msg}\n\n${body}` : msg], cwd, { env })
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'log': {
      const r = await git(
        ['log', '--max-count', String(payload.limit || 100), '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%P%x1e'],
        cwd
      )
      return { ok: r.ok, commits: parseLog(r.stdout), error: r.stderr }
    }
    case 'commitFiles': {
      const r = await git(['show', '--pretty=format:', '--name-status', payload.sha], cwd)
      return { ok: r.ok, files: parseNameStatus(r.stdout) }
    }
    case 'checkout': {
      const r = await git(['checkout', payload.branch], cwd)
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'createBranch': {
      const args = payload.startPoint
        ? ['checkout', '-b', payload.name, payload.startPoint]
        : ['checkout', '-b', payload.name]
      const r = await git(args, cwd)
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'renameBranch': {
      const r = await git(['branch', '-m', payload.from, payload.to], cwd)
      return { ok: r.ok, error: r.stderr }
    }
    case 'deleteBranch': {
      const r = await git(['branch', payload.force ? '-D' : '-d', payload.name], cwd)
      return { ok: r.ok, error: r.stderr }
    }
    case 'fetch': {
      const r = await git(['fetch', '--prune', payload.remote || 'origin'], cwd, { timeout: 300000 })
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'pull': {
      const remote = payload.remote || 'origin'
      let r = await git(['pull', remote, payload.rebase ? '--rebase' : '--ff-only'], cwd, { timeout: 300000 })
      if (!r.ok && !payload.rebase && /Not possible to fast-forward/i.test(r.stderr + r.stdout)) {
        r = await git(['pull', remote, '--no-rebase'], cwd, { timeout: 300000 })
      }
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'push': {
      const args = ['push', payload.remote || 'origin']
      if (payload.setUpstream) args.push('-u', payload.remote || 'origin', payload.branch)
      else if (payload.branch) args.push(payload.branch)
      if (payload.force) args.push('--force-with-lease')
      const r = await git(args, cwd, { timeout: 300000 })
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'publish': {
      const r = await git(['push', '-u', 'origin', payload.branch], cwd, { timeout: 300000 })
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'merge': {
      const r = await git(['merge', payload.branch], cwd)
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'rebase': {
      const r = await git(['rebase', payload.branch], cwd)
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    case 'stash': {
      const r = await git(['stash', 'push', '-u', '-m', payload.message || 'Stashed changes'], cwd)
      return { ok: r.ok, error: r.stderr }
    }
    case 'clone': {
      fs.mkdirSync(path.dirname(payload.directory), { recursive: true })
      const r = await git(['clone', payload.url, payload.directory], undefined, { timeout: 600000 })
      return { ok: r.ok, error: r.stderr || r.stdout, path: payload.directory }
    }
    case 'init': {
      const dest = payload.directory
      fs.mkdirSync(dest, { recursive: true })
      const branch = payload.branch || identityPrefs.defaultBranch || 'main'
      let r = await git(['init', '-b', branch], dest)
      if (!r.ok) {
        await git(['init'], dest)
        await git(['checkout', '-b', branch], dest)
      }
      if (payload.readme) {
        fs.writeFileSync(
          path.join(dest, 'README.md'),
          `# ${payload.name || path.basename(dest)}\n${payload.description ? `\n${payload.description}\n` : ''}`,
          'utf8'
        )
      }
      if (payload.gitignore) fs.writeFileSync(path.join(dest, '.gitignore'), payload.gitignore, 'utf8')
      if (payload.license) fs.writeFileSync(path.join(dest, 'LICENSE'), payload.license, 'utf8')
      await git(['add', '-A'], dest)
      const has = await git(['status', '--porcelain=v1'], dest)
      if (has.stdout.trim()) await git(['commit', '-m', 'Initial commit'], dest, { env })
      return { ok: true, path: dest }
    }
    case 'addRemote': {
      const r = await git(['remote', 'add', payload.name || 'origin', payload.url], cwd)
      return { ok: r.ok, error: r.stderr }
    }
    case 'setRemote': {
      const r = await git(['remote', 'set-url', payload.name || 'origin', payload.url], cwd)
      return { ok: r.ok, error: r.stderr }
    }
    default:
      return { ok: false, error: `Unknown git action: ${action}` }
  }
}

module.exports = { GIT, git, dispatch }
