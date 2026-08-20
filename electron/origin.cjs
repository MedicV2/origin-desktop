const fs = require('fs')
const os = require('os')
const path = require('path')
const { findExecutable, run } = require('./spawn.cjs')
const { git } = require('./git.cjs')
const { ORIGIN_GIT, parseRepoList, parseJsonOrNull, parseAuthStatus } = require('./parse.cjs')
const { avatarDataUrl } = require('./profile.cjs')

const ORIGIN = findExecutable([
  path.join(process.env.LOCALAPPDATA || '', 'cursor', 'bin', 'origin.exe'),
  path.join(os.homedir(), '.local', 'bin', 'origin.exe'),
  path.join(os.homedir(), '.local', 'bin', 'origin'),
  'origin',
])

function origin(args, extra = {}) {
  return run(ORIGIN, args, { cwd: extra.cwd, timeout: extra.timeout ?? 180000 })
}

async function dispatch(action, payload = {}) {
  switch (action) {
    case 'authStatus': {
      const r = await origin(['auth', 'status'])
      const parsed = parseAuthStatus(`${r.stdout}\n${r.stderr}`)
      return {
        ok: r.ok && parsed.token,
        signedIn: parsed.token && Boolean(parsed.account),
        account: parsed.account,
        method: parsed.method,
        endpoint: parsed.endpoint,
        raw: parsed.raw,
        installed: r.code !== -1,
      }
    }
    case 'profile': {
      const r = await origin(['auth', 'status'])
      const parsed = parseAuthStatus(`${r.stdout}\n${r.stderr}`)
      const avatar = parsed.account ? await avatarDataUrl(parsed.account) : null
      return {
        ok: r.ok && parsed.token,
        signedIn: parsed.token && Boolean(parsed.account),
        account: parsed.account,
        avatar,
      }
    }
    case 'authLogin': {
      await run(ORIGIN, ['auth', 'login'], { detached: true, stdio: 'ignore', windowsHide: false })
      return { ok: true }
    }
    case 'authLogout': {
      const r = await origin(['auth', 'logout'])
      return { ok: r.ok, error: r.stderr }
    }
    case 'repoList': {
      const args = ['repo', 'list']
      if (payload.namespace) args.push('--namespace', payload.namespace)
      const r = await origin(args)
      if (!r.ok) return { ok: false, error: r.stderr || r.stdout, repos: [] }
      return { ok: true, repos: parseRepoList(r.stdout) }
    }
    case 'repoCreate': {
      const name = payload.repo
      const args = ['repo', 'create', name]
      if (payload.defaultBranch) args.push('--default-branch', payload.defaultBranch)
      const r = await origin(args)
      let fullName = name
      if (!name.includes('/')) {
        const list = await origin(['repo', 'list'])
        const match = parseRepoList(list.stdout).find((x) => x.name === name)
        if (match) fullName = match.fullName
      }
      return {
        ok: r.ok,
        error: r.stderr || (!r.ok ? r.stdout : ''),
        cloneUrl: `${ORIGIN_GIT}/${fullName}.git`,
        fullName,
      }
    }
    case 'repoClone': {
      const dest = payload.directory
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const r = await origin(['repo', 'clone', payload.repo, dest], { timeout: 600000 })
      if (r.ok) return { ok: true, path: dest }
      const g = await git(['clone', `${ORIGIN_GIT}/${payload.repo}.git`, dest], undefined, { timeout: 600000 })
      return { ok: g.ok, error: r.stderr || g.stderr || g.stdout, path: dest }
    }
    case 'prList': {
      const r = await origin([
        'pr',
        'list',
        '-R',
        payload.repo,
        '-s',
        payload.state || 'open',
        '-L',
        String(payload.limit || 50),
        '--json',
        'number,title,status,headRef,baseRef,url,authorId,createdAt,updatedAt,additions,deletions,changedFiles,headSha',
      ])
      const json = parseJsonOrNull(r.stdout)
      const list = Array.isArray(json) ? json : json?.pullRequests || json?.items || []
      return { ok: r.ok, pullRequests: list, error: r.stderr, raw: r.stdout }
    }
    case 'prCreate': {
      const args = ['pr', 'create', '-R', payload.repo, '--status', payload.draft ? 'draft' : 'open']
      if (payload.title) args.push('-t', payload.title)
      if (payload.body) args.push('-b', payload.body)
      if (payload.head) args.push('-H', payload.head)
      if (payload.base) args.push('-B', payload.base)
      if (payload.push) args.push('--push')
      const r = await origin(args, { cwd: payload.path })
      return { ok: r.ok, output: r.stdout, error: r.stderr || (!r.ok ? r.stdout : '') }
    }
    case 'prCheckout': {
      const r = await origin(['pr', 'checkout', String(payload.number), '-R', payload.repo], { cwd: payload.path })
      return { ok: r.ok, error: r.stderr || r.stdout }
    }
    default:
      return { ok: false, error: `Unknown origin action: ${action}` }
  }
}

module.exports = { ORIGIN, dispatch }
